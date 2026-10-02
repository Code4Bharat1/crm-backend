import nodemailer from 'nodemailer';
import mongoose from 'mongoose';
import CompanySettings from '../models/CompanySettings.js';
import Customer from '../models/Customer.js';
import Lead from '../models/Lead.js';
import { generateDocumentPDF } from './generateDocumentPDF.js';

/**
 * Formats currency in INR format (e.g. ₹1,23,456.00)
 */
const fmtINR = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '₹0.00';
  return '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * Formats date into DD MMM YYYY (e.g. 02 Oct 2026)
 */
const fmtDate = (d) => {
  if (!d) return 'N/A';
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return String(d);
  }
};

/**
 * Resolves customer email address with fallbacks to Customer and Lead collections.
 */
export const resolveCustomerEmail = async (doc) => {
  if (doc?.customer?.email && doc.customer.email.trim() && doc.customer.email.includes('@')) {
    return doc.customer.email.trim();
  }

  // 1. Try finding in Customer collection by ID
  if (doc?.customer?.id) {
    try {
      const isObjId = mongoose.isValidObjectId(doc.customer.id);
      const cust = await Customer.findOne({
        $or: [
          { id: String(doc.customer.id) },
          ...(isObjId ? [{ _id: doc.customer.id }] : [])
        ]
      }).lean();

      if (cust?.contactPerson?.email && cust.contactPerson.email.includes('@')) {
        return cust.contactPerson.email.trim();
      }
      if (cust?.email && cust.email.includes('@')) {
        return cust.email.trim();
      }
    } catch (e) {
      console.warn('Error querying customer for email resolution:', e.message);
    }
  }

  // 2. Try finding by customer name in Customer and Lead collections
  if (doc?.customer?.name) {
    try {
      const custByName = await Customer.findOne({
        name: { $regex: new RegExp(`^${doc.customer.name.trim()}$`, 'i') }
      }).lean();

      if (custByName?.contactPerson?.email && custByName.contactPerson.email.includes('@')) {
        return custByName.contactPerson.email.trim();
      }
      if (custByName?.email && custByName.email.includes('@')) {
        return custByName.email.trim();
      }

      const lead = await Lead.findOne({
        customerName: { $regex: new RegExp(`^${doc.customer.name.trim()}$`, 'i') }
      }).lean();

      if (lead?.customerEmail && lead.customerEmail.includes('@')) {
        return lead.customerEmail.trim();
      }
    } catch (e) {
      console.warn('Error querying customer/lead by name for email resolution:', e.message);
    }
  }

  return null;
};

/**
 * Sends an automated, beautifully styled email to the customer when a Quotation,
 * Proforma Invoice, or Sales Invoice is created.
 *
 * @param {'Quotation' | 'Proforma Invoice' | 'Sales Invoice'} docType
 * @param {Object} doc - Document instance from MongoDB
 * @returns {Promise<{success: boolean, recipient?: string, messageId?: string, error?: string}>}
 */
export const sendDocumentEmail = async (docType, doc) => {
  try {
    if (!process.env.EMAIL_ID || !process.env.EMAIL_PASSWORD) {
      console.warn(`[sendDocumentEmail] EMAIL_ID or EMAIL_PASSWORD not configured in environment.`);
      return { success: false, error: 'Email credentials not configured' };
    }

    const recipientEmail = await resolveCustomerEmail(doc);
    if (!recipientEmail) {
      console.warn(`[sendDocumentEmail] No email address found for customer '${doc?.customer?.name}' on ${docType}. Skipping email.`);
      return { success: false, error: 'Customer email address not found' };
    }

    // Fetch company settings for branding and bank details
    let company = await CompanySettings.findOne().lean().catch(() => null);
    if (!company) {
      company = {
        name: 'Nexcore Alliance Pvt. Ltd.',
        phone: '+91 20 1234 5678',
        email: process.env.EMAIL_ID,
        website: 'www.nexcorealliance.com',
        gstNumber: '27AABCN1234A1Z5',
        address: {
          line1: '123, Industrial Area, Phase II',
          line2: 'Bhosari, Pune - 411026',
          city: 'Pune',
          state: 'Maharashtra',
          pinCode: '411026',
          country: 'India',
        },
        bankDetails: {
          bankName: 'HDFC Bank Ltd.',
          branch: 'Bhosari, Pune',
          accountNumber: '50100123456789',
          ifscCode: 'HDFC0001234',
          accountName: 'Nexcore Alliance Pvt. Ltd.',
          upiId: 'nexcore@hdfcbank',
        },
      };
    }

    const docNo = doc.quotationNo || doc.proformaNo || doc.invoiceNo || 'DOC';
    const customerName = doc.customer?.name || 'Valued Customer';
    const contactPerson = doc.customer?.contactPerson || customerName;
    const customerGst = doc.customer?.gstNumber || 'N/A';
    const customerPhone = doc.customer?.phone || 'N/A';
    const customerAddress = typeof doc.customer?.address === 'string'
      ? doc.customer.address
      : (doc.billingAddress || 'N/A');

    const dateStr = fmtDate(doc.date || doc.createdAt);
    const validOrDueDateStr = fmtDate(doc.validUntil || doc.dueDate);
    const salesperson = doc.salesperson || 'Sales Team';

    // Theme color configuration based on document type
    let themeColor = '#2563eb'; // Blue for Quotation
    let badgeText = 'QUOTATION ESTIMATE';
    let subjectDocName = 'Quotation';
    let actionNotice = 'Please review the quotation details below. If you have any questions or would like to approve, kindly get in touch with our representative.';

    if (docType === 'Proforma Invoice') {
      themeColor = '#7c3aed'; // Purple / Indigo
      badgeText = 'PROFORMA INVOICE';
      subjectDocName = 'Proforma Invoice';
      actionNotice = `Kindly arrange the advance payment of ${fmtINR(doc.advanceRequired || 0)} using the bank details provided below so we may proceed with order processing.`;
    } else if (docType === 'Sales Invoice') {
      themeColor = '#059669'; // Emerald Green
      badgeText = 'TAX INVOICE';
      subjectDocName = 'Tax Invoice';
      actionNotice = `Please find your tax invoice details below. Total balance due: ${fmtINR(doc.balanceAmount !== undefined ? doc.balanceAmount : doc.grandTotal)}.`;
    }

    // Build items HTML table rows
    const items = doc.items || [];
    const itemsRowsHtml = items.map((item, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #334155;">
        <td style="padding: 10px 8px; text-align: center; color: #64748b;">${idx + 1}</td>
        <td style="padding: 10px 8px;">
          <div style="font-weight: 600; color: #0f172a;">${item.description || 'Item'}</div>
          ${item.productCode ? `<div style="font-size: 11px; color: #64748b; font-family: monospace;">Code: ${item.productCode}</div>` : ''}
        </td>
        <td style="padding: 10px 8px; text-align: center; color: #64748b; font-family: monospace;">${item.hsnCode || '-'}</td>
        <td style="padding: 10px 8px; text-align: center; font-weight: 600; color: #0f172a;">${item.qty || 1} ${item.unit || 'Nos'}</td>
        <td style="padding: 10px 8px; text-align: right; color: #334155;">${fmtINR(item.rate)}</td>
        <td style="padding: 10px 8px; text-align: center; color: #64748b;">${item.gstRate || 18}%</td>
        <td style="padding: 10px 8px; text-align: right; font-weight: 600; color: #0f172a;">${fmtINR(item.totalAmount || item.taxableAmount)}</td>
      </tr>
    `).join('');

    // Full responsive HTML Email Template
    const htmlContent = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${subjectDocName} ${docNo}</title>
</head>
<body style="margin: 0; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #1e293b;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 680px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    
    <!-- Header -->
    <tr>
      <td style="background-color: #0f172a; padding: 24px 28px; border-top-left-radius: 12px; border-top-right-radius: 12px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="vertical-align: middle;">
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: 0.5px;">${company.name || 'CONTECH'}</h1>
              <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 12px;">${company.tagline || 'Automation & Industrial Solutions'}</p>
            </td>
            <td style="text-align: right; vertical-align: middle;">
              <span style="background-color: ${themeColor}; color: #ffffff; padding: 6px 14px; font-size: 11px; font-weight: 700; letter-spacing: 0.8px; border-radius: 20px; text-transform: uppercase; display: inline-block;">
                ${badgeText}
              </span>
              <div style="color: #ffffff; font-family: monospace; font-size: 14px; font-weight: bold; margin-top: 6px;">
                ${docNo}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Salutation & Main Notice -->
    <tr>
      <td style="padding: 24px 28px 12px 28px;">
        <p style="margin: 0 0 8px 0; font-size: 15px; font-weight: 700; color: #0f172a;">Dear ${contactPerson},</p>
        <p style="margin: 0 0 16px 0; font-size: 13px; line-height: 1.5; color: #475569;">
          Thank you for your business. We have generated <strong>${subjectDocName} ${docNo}</strong> for <strong>${customerName}</strong>. The official PDF document is attached to this email for your reference and records.
        </p>
      </td>
    </tr>

    <!-- Meta Details Cards (2 Columns) -->
    <tr>
    
      <td style="padding: 0 28px 20px 28px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <!-- Customer Details Card -->
            <td width="48%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; vertical-align: top;">
              <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
                Customer / Billed To
              </div>
              <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 2px;">${customerName}</div>
              ${doc.customer?.contactPerson ? `<div style="font-size: 12px; color: #475569;">Attn: ${doc.customer.contactPerson}</div>` : ''}
              ${customerAddress && customerAddress !== 'N/A' ? `<div style="font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.4;">${customerAddress}</div>` : ''}
              ${customerGst && customerGst !== 'N/A' ? `<div style="font-size: 11px; color: #0f172a; font-weight: 600; margin-top: 4px;">GSTIN: <span style="font-family: monospace;">${customerGst}</span></div>` : ''}
              <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Email: ${recipientEmail}</div>
            </td>

            <td width="4%">&nbsp;</td>

            <!-- Document Details Card -->
            <td width="48%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; vertical-align: top;">
              <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
                Document Overview
              </div>
              <table border="0" cellpadding="2" cellspacing="0" width="100%" style="font-size: 12px; color: #334155;">
                <tr>
                  <td style="color: #64748b;">Doc Number:</td>
                  <td style="font-weight: 700; font-family: monospace; text-align: right; color: #0f172a;">${docNo}</td>
                </tr>
                <tr>
                  <td style="color: #64748b;">Date:</td>
                  <td style="font-weight: 600; text-align: right;">${dateStr}</td>
                </tr>
                <tr>
                  <td style="color: #64748b;">${docType === 'Quotation' ? 'Valid Until:' : 'Due Date:'}</td>
                  <td style="font-weight: 600; text-align: right; color: ${themeColor};">${validOrDueDateStr}</td>
                </tr>
                ${doc.quotationRef ? `<tr><td style="color: #64748b;">Quotation Ref:</td><td style="font-family: monospace; text-align: right;">${doc.quotationRef}</td></tr>` : ''}
                ${doc.soRef ? `<tr><td style="color: #64748b;">SO Ref:</td><td style="font-family: monospace; text-align: right;">${doc.soRef}</td></tr>` : ''}
                ${doc.dnRef ? `<tr><td style="color: #64748b;">DN Ref:</td><td style="font-family: monospace; text-align: right;">${doc.dnRef}</td></tr>` : ''}
                <tr>
                  <td style="color: #64748b;">Sales Rep:</td>
                  <td style="text-align: right; color: #0f172a;">${salesperson}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Line Items Table -->
    <tr>
      <td style="padding: 0 28px 20px 28px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background-color: #0f172a; color: #ffffff; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">
              <th style="padding: 10px 8px; text-align: center; width: 6%;">#</th>
              <th style="padding: 10px 8px; text-align: left; width: 44%;">Description</th>
              <th style="padding: 10px 8px; text-align: center; width: 12%;">HSN</th>
              <th style="padding: 10px 8px; text-align: center; width: 10%;">Qty</th>
              <th style="padding: 10px 8px; text-align: right; width: 14%;">Rate</th>
              <th style="padding: 10px 8px; text-align: center; width: 8%;">GST</th>
              <th style="padding: 10px 8px; text-align: right; width: 16%;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRowsHtml}
          </tbody>
        </table>
      </td>
    </tr>

    <!-- Totals Breakdown & Grand Total -->
    <tr>
      <td style="padding: 0 28px 24px 28px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td width="45%" style="vertical-align: top; padding-right: 16px;">
              <div style="font-size: 12px; line-height: 1.5; color: #475569; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
                <strong style="color: #0f172a;">Note:</strong><br/>
                ${actionNotice}
              </div>
            </td>
            
            <td width="55%" style="vertical-align: top;">
              <table border="0" cellpadding="4" cellspacing="0" width="100%" style="font-size: 13px; color: #334155;">
                <tr>
                  <td style="color: #64748b;">Subtotal:</td>
                  <td style="text-align: right; font-weight: 600;">${fmtINR(doc.subtotal)}</td>
                </tr>
                ${doc.totalDiscount > 0 ? `<tr><td style="color: #dc2626;">Discount:</td><td style="text-align: right; color: #dc2626; font-weight: 600;">- ${fmtINR(doc.totalDiscount)}</td></tr>` : ''}
                ${doc.isInterState
                  ? `<tr><td style="color: #64748b;">IGST:</td><td style="text-align: right;">${fmtINR(doc.totalIgst)}</td></tr>`
                  : `<tr><td style="color: #64748b;">CGST:</td><td style="text-align: right;">${fmtINR(doc.totalCgst)}</td></tr><tr><td style="color: #64748b;">SGST:</td><td style="text-align: right;">${fmtINR(doc.totalSgst)}</td></tr>`
                }
                ${doc.roundOff ? `<tr><td style="color: #64748b;">Round Off:</td><td style="text-align: right;">${fmtINR(doc.roundOff)}</td></tr>` : ''}
                
                <tr style="border-top: 2px solid #0f172a; font-size: 15px;">
                  <td style="font-weight: 800; color: #0f172a; padding-top: 8px;">Grand Total:</td>
                  <td style="text-align: right; font-weight: 800; color: ${themeColor}; padding-top: 8px; font-size: 16px;">
                    ${fmtINR(doc.grandTotal)}
                  </td>
                </tr>

                ${docType === 'Proforma Invoice' && doc.advanceRequired > 0 ? `
                  <tr style="background-color: #faf5ff; border: 1px solid #e9d5ff; border-radius: 6px;">
                    <td style="color: #6b21a8; font-weight: 700; padding: 6px 8px;">Advance Required:</td>
                    <td style="text-align: right; color: #6b21a8; font-weight: 800; padding: 6px 8px; font-size: 15px;">
                      ${fmtINR(doc.advanceRequired)}
                    </td>
                  </tr>
                ` : ''}

                ${docType === 'Sales Invoice' && doc.advanceAdjusted > 0 ? `
                  <tr>
                    <td style="color: #059669; font-weight: 600;">Advance Adjusted:</td>
                    <td style="text-align: right; color: #059669; font-weight: 600;">- ${fmtINR(doc.advanceAdjusted)}</td>
                  </tr>
                  <tr style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px;">
                    <td style="color: #166534; font-weight: 700; padding: 6px 8px;">Balance Payable:</td>
                    <td style="text-align: right; color: #166534; font-weight: 800; padding: 6px 8px; font-size: 15px;">
                      ${fmtINR(doc.balanceAmount !== undefined ? doc.balanceAmount : Math.max(0, (doc.grandTotal || 0) - (doc.advanceAdjusted || 0)))}
                    </td>
                  </tr>
                ` : ''}
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Bank Details Box (Essential for Proforma & Invoices) -->
    ${company.bankDetails ? `
    <tr>
      <td style="padding: 0 28px 20px 28px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px;">
          <tr>
            <td>
              <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #475569; letter-spacing: 0.5px; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
                🏦 Company Remittance & Banking Information
              </div>
              <table border="0" cellpadding="3" cellspacing="0" width="100%" style="font-size: 12px; color: #334155;">
                <tr>
                  <td width="28%" style="color: #64748b;">Bank Name:</td>
                  <td style="font-weight: 600; color: #0f172a;">${company.bankDetails.bankName || 'HDFC Bank Ltd.'}</td>
                  <td width="20%" style="color: #64748b;">A/C Number:</td>
                  <td style="font-weight: 700; font-family: monospace; color: #0f172a;">${company.bankDetails.accountNumber || '-'}</td>
                </tr>
                <tr>
                  <td style="color: #64748b;">Account Name:</td>
                  <td style="font-weight: 600; color: #0f172a;">${company.bankDetails.accountName || company.name}</td>
                  <td style="color: #64748b;">IFSC Code:</td>
                  <td style="font-weight: 700; font-family: monospace; color: #0f172a;">${company.bankDetails.ifscCode || '-'}</td>
                </tr>
                <tr>
                  <td style="color: #64748b;">Branch:</td>
                  <td>${company.bankDetails.branch || 'Pune'}</td>
                  ${company.bankDetails.upiId ? `<td style="color: #64748b;">UPI ID:</td><td style="font-family: monospace; font-weight: 600; color: #2563eb;">${company.bankDetails.upiId}</td>` : '<td colspan="2"></td>'}
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    ` : ''}

    <!-- Terms & Conditions Section -->
    ${(doc.termsAndConditions || company.termsAndConditions) ? `
    <tr>
      <td style="padding: 0 28px 24px 28px;">
        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 4px;">Terms & Conditions</div>
        <div style="font-size: 11px; color: #64748b; line-height: 1.5; white-space: pre-line; background-color: #f8fafc; border: 1px solid #f1f5f9; padding: 8px 12px; border-radius: 6px;">
          ${doc.termsAndConditions || company.termsAndConditions}
        </div>
      </td>
    </tr>
    ` : ''}

    <!-- Footer -->
    <tr>
      <td style="background-color: #f8fafc; padding: 20px 28px; border-top: 1px solid #e2e8f0; border-bottom-left-radius: 12px; border-bottom-right-radius: 12px; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.5;">
        <strong>${company.name}</strong> | GSTIN: ${company.gstNumber || '-'} | Phone: ${company.phone || '-'} | Email: ${company.email || '-'}<br/>
        Address: ${company.address?.line1 || ''}, ${company.address?.city || ''}, ${company.address?.state || ''} - ${company.address?.pinCode || ''}<br/>
        <span style="font-size: 10px; color: #cbd5e1; margin-top: 6px; display: block;">This is an automated document generated from CONTECH CRM. Please find the official PDF attached.</span>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    // Plain text alternative for email clients without HTML support
    const plainText = `
${company.name}
${badgeText}: ${docNo}
Date: ${dateStr}
Customer: ${customerName} (Attn: ${contactPerson})
Recipient Email: ${recipientEmail}

[Note: The official PDF document is attached to this email.]

--------------------------------------------------
ITEMS:
${items.map((it, i) => `${i + 1}. ${it.description} | Qty: ${it.qty} ${it.unit || 'Nos'} | Rate: ₹${it.rate} | Total: ₹${it.totalAmount}`).join('\n')}
--------------------------------------------------
Subtotal: ${fmtINR(doc.subtotal)}
${doc.totalDiscount > 0 ? `Discount: -${fmtINR(doc.totalDiscount)}\n` : ''}GST: ${fmtINR((doc.totalCgst || 0) + (doc.totalSgst || 0) + (doc.totalIgst || 0))}
Grand Total: ${fmtINR(doc.grandTotal)}
${docType === 'Proforma Invoice' && doc.advanceRequired ? `Advance Required: ${fmtINR(doc.advanceRequired)}\n` : ''}${docType === 'Sales Invoice' && doc.balanceAmount !== undefined ? `Balance Payable: ${fmtINR(doc.balanceAmount)}\n` : ''}
Bank Details for Remittance:
Bank: ${company.bankDetails?.bankName || 'HDFC Bank Ltd.'}
A/C: ${company.bankDetails?.accountNumber || '-'}
IFSC: ${company.bankDetails?.ifscCode || '-'}
A/C Name: ${company.bankDetails?.accountName || company.name}

Best regards,
${company.name}
Phone: ${company.phone || ''} | Email: ${company.email || ''}
    `.trim();

    // Generate vector PDF buffer to attach
    const attachments = [];
    try {
      const pdfBuffer = await generateDocumentPDF(docType, doc, company);
      if (pdfBuffer && pdfBuffer.length > 0) {
        const safeDocNo = (docNo || 'Document').replace(/[^a-zA-Z0-9-_]/g, '_');
        const pdfFileName = `${subjectDocName.replace(/\s+/g, '_')}_${safeDocNo}.pdf`;
        attachments.push({
          filename: pdfFileName,
          content: pdfBuffer,
          contentType: 'application/pdf',
        });
        console.log(`📎 [sendDocumentEmail] Generated PDF attachment: ${pdfFileName} (${pdfBuffer.length} bytes)`);
      }
    } catch (pdfErr) {
      console.warn(`⚠️ [sendDocumentEmail] Failed to generate PDF attachment for ${docType} ${docNo}:`, pdfErr.message);
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_ID,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const senderDisplayName = company.name || 'CONTECH CRM';
    const mailSubject = `${subjectDocName} ${docNo} from ${senderDisplayName} - ${customerName}`;

    const mailOptions = {
      from: `"${senderDisplayName}" <${process.env.EMAIL_ID}>`,
      replyTo: company.email || process.env.EMAIL_ID,
      to: recipientEmail,
      subject: mailSubject,
      html: htmlContent,
      text: plainText,
      attachments,
      headers: {
        'X-Mailer': 'CONTECH CRM Document Delivery Engine',
        'X-Document-Type': docType,
        'X-Document-Number': docNo,
      },
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ [sendDocumentEmail] Automated email with PDF sent for ${docType} ${docNo} to ${recipientEmail} (MessageId: ${info.messageId})`);
    return { success: true, recipient: recipientEmail, messageId: info.messageId, attachmentCount: attachments.length };
  } catch (error) {
    console.error(`❌ [sendDocumentEmail] Failed to send email for ${docType}:`, error.message);
    return { success: false, error: error.message };
  }
};

