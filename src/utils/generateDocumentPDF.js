import PDFDocument from 'pdfkit';

/**
 * Format currency in Indian numbering format with INR prefix
 */
const fmtINR = (val) => {
  if (val === undefined || val === null || isNaN(val)) return 'INR 0.00';
  return 'INR ' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * Format date to DD MMM YYYY
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
 * Generates a high-quality, professional vector PDF Buffer for Quotation, Proforma Invoice, or Sales Invoice.
 *
 * @param {'Quotation' | 'Proforma Invoice' | 'Sales Invoice'} docType
 * @param {Object} doc - Document object
 * @param {Object} company - Company settings object
 * @returns {Promise<Buffer>}
 */
export const generateDocumentPDF = (docType, doc, company = {}) => {
  return new Promise((resolve, reject) => {
    try {
      const pdf = new PDFDocument({
        size: 'A4',
        margin: 36,
        bufferPages: true,
        info: {
          Title: `${docType} - ${doc.quotationNo || doc.proformaNo || doc.invoiceNo || 'Document'}`,
          Author: company?.name || 'Nexcore Alliance Pvt. Ltd.',
          Subject: `${docType} for ${doc.customer?.name || 'Customer'}`,
        },
      });

      const buffers = [];
      pdf.on('data', chunk => buffers.push(chunk));
      pdf.on('end', () => resolve(Buffer.concat(buffers)));
      pdf.on('error', err => reject(err));

      const docNo = doc.quotationNo || doc.proformaNo || doc.invoiceNo || 'DOC-001';
      const customerName = doc.customer?.name || 'Valued Customer';
      const contactPerson = doc.customer?.contactPerson || '';
      const customerEmail = doc.customer?.email || '';
      const customerGst = doc.customer?.gstNumber || 'N/A';
      const customerAddress = typeof doc.customer?.address === 'string'
        ? doc.customer.address
        : (doc.billingAddress || 'N/A');

      const dateStr = fmtDate(doc.date || doc.createdAt);
      const validOrDueDateStr = fmtDate(doc.validUntil || doc.dueDate);
      const salesperson = doc.salesperson || 'Sales Team';

      // Primary theme colors
      let primaryColor = '#2563eb'; // Blue for Quotation
      let badgeTitle = 'QUOTATION';
      if (docType === 'Proforma Invoice') {
        primaryColor = '#7c3aed'; // Purple for Proforma
        badgeTitle = 'PROFORMA INVOICE';
      } else if (docType === 'Sales Invoice') {
        primaryColor = '#059669'; // Emerald for Sales Invoice
        badgeTitle = 'TAX INVOICE';
      }

      const compName = company?.name || 'Nexcore Alliance Pvt. Ltd.';
      const compTagline = company?.tagline || 'Automation & Industrial Solutions';
      const compGst = company?.gstNumber || '27AABCN1234A1Z5';
      const compPhone = company?.phone || '+91 20 1234 5678';
      const compEmail = company?.email || process.env.EMAIL_ID || 'info@nexcorealliance.com';
      const compWebsite = company?.website || 'www.nexcorealliance.com';
      const compAddr = company?.address
        ? `${company.address.line1 || ''}, ${company.address.city || ''}, ${company.address.state || ''} - ${company.address.pinCode || ''}`
        : 'Industrial Area, Pune - 411026, Maharashtra, India';

      // 1. Header Banner
      const startY = 36;
      pdf.rect(36, startY, 523, 72).fill('#0f172a');

      // Company Info (Left)
      pdf.fillColor('#ffffff').fontSize(15).font('Helvetica-Bold').text(compName, 50, startY + 12);
      pdf.fillColor('#94a3b8').fontSize(8.5).font('Helvetica').text(compTagline, 50, startY + 31);
      pdf.fillColor('#cbd5e1').fontSize(7.5).font('Helvetica').text(`GSTIN: ${compGst} | Phone: ${compPhone} | Email: ${compEmail}`, 50, startY + 45);

      // Document Badge (Right)
      pdf.rect(390, startY + 14, 155, 22).fill(primaryColor);
      pdf.fillColor('#ffffff').fontSize(9.5).font('Helvetica-Bold').text(badgeTitle, 390, startY + 20, { width: 155, align: 'center' });
      pdf.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold').text(docNo, 390, startY + 44, { width: 155, align: 'center' });

      // 2. Meta Info (Customer & Document Overview)
      const metaY = startY + 82;

      // Customer Box (Left)
      pdf.rect(36, metaY, 255, 96).fillAndStroke('#f8fafc', '#e2e8f0');
      pdf.fillColor('#475569').fontSize(8).font('Helvetica-Bold').text('BILLED TO / CUSTOMER', 46, metaY + 8);
      pdf.fillColor('#0f172a').fontSize(9.5).font('Helvetica-Bold').text(customerName, 46, metaY + 22, { width: 235 });
      
      let custDetailsY = metaY + 36;
      if (contactPerson) {
        pdf.fillColor('#334155').fontSize(8).font('Helvetica').text(`Attn: ${contactPerson}`, 46, custDetailsY);
        custDetailsY += 11;
      }
      if (customerAddress && customerAddress !== 'N/A') {
        pdf.fillColor('#64748b').fontSize(7.5).font('Helvetica').text(customerAddress, 46, custDetailsY, { width: 235, height: 20, ellipsis: true });
        custDetailsY += 18;
      }
      pdf.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text(`GSTIN: ${customerGst}`, 46, custDetailsY);
      if (customerEmail) {
        pdf.fillColor('#2563eb').fontSize(7.5).font('Helvetica').text(`Email: ${customerEmail}`, 46, custDetailsY + 11);
      }

      // Document Details Box (Right)
      pdf.rect(304, metaY, 255, 96).fillAndStroke('#f8fafc', '#e2e8f0');
      pdf.fillColor('#475569').fontSize(8).font('Helvetica-Bold').text('DOCUMENT OVERVIEW', 314, metaY + 8);

      let docDetailsY = metaY + 22;
      const drawMetaRow = (label, val, isBoldVal = false, valColor = '#0f172a') => {
        pdf.fillColor('#64748b').fontSize(8).font('Helvetica').text(label, 314, docDetailsY);
        pdf.fillColor(valColor).fontSize(8).font(isBoldVal ? 'Helvetica-Bold' : 'Helvetica').text(val, 400, docDetailsY, { width: 149, align: 'right' });
        docDetailsY += 13;
      };

      drawMetaRow('Document No:', docNo, true);
      drawMetaRow('Date:', dateStr);
      drawMetaRow(docType === 'Quotation' ? 'Valid Until:' : 'Due Date:', validOrDueDateStr, true, primaryColor);
      if (doc.quotationRef) drawMetaRow('Quotation Ref:', doc.quotationRef);
      if (doc.soRef) drawMetaRow('SO Ref:', doc.soRef);
      if (doc.dnRef) drawMetaRow('DN Ref:', doc.dnRef);
      drawMetaRow('Sales Rep:', salesperson);

      // 3. Line Items Table
      let tableY = metaY + 106;

      // Table Header
      pdf.rect(36, tableY, 523, 20).fill('#0f172a');
      pdf.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      pdf.text('#', 42, tableY + 6, { width: 20, align: 'center' });
      pdf.text('DESCRIPTION / PRODUCT', 68, tableY + 6, { width: 210, align: 'left' });
      pdf.text('HSN', 282, tableY + 6, { width: 45, align: 'center' });
      pdf.text('QTY', 332, tableY + 6, { width: 35, align: 'center' });
      pdf.text('RATE (INR)', 372, tableY + 6, { width: 55, align: 'right' });
      pdf.text('GST', 432, tableY + 6, { width: 35, align: 'center' });
      pdf.text('AMOUNT (INR)', 472, tableY + 6, { width: 80, align: 'right' });

      tableY += 20;

      // Table Rows
      const items = doc.items || [];
      items.forEach((item, idx) => {
        const rowHeight = 22;
        const bgFill = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
        pdf.rect(36, tableY, 523, rowHeight).fillAndStroke(bgFill, '#e2e8f0');

        pdf.fillColor('#64748b').fontSize(8).font('Helvetica').text(String(idx + 1), 42, tableY + 6, { width: 20, align: 'center' });
        
        pdf.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text(item.description || 'Item', 68, tableY + 6, { width: 210, height: 14, ellipsis: true });
        
        pdf.fillColor('#64748b').fontSize(7.5).font('Helvetica').text(item.hsnCode || '-', 282, tableY + 6, { width: 45, align: 'center' });
        
        pdf.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text(`${item.qty || 1} ${item.unit || 'Nos'}`, 332, tableY + 6, { width: 35, align: 'center' });
        
        pdf.fillColor('#334155').fontSize(8).font('Helvetica').text(Number(item.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }), 372, tableY + 6, { width: 55, align: 'right' });
        
        pdf.fillColor('#64748b').fontSize(7.5).font('Helvetica').text(`${item.gstRate || 18}%`, 432, tableY + 6, { width: 35, align: 'center' });
        
        const lineTotal = item.totalAmount !== undefined ? item.totalAmount : item.taxableAmount;
        pdf.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text(Number(lineTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }), 472, tableY + 6, { width: 80, align: 'right' });

        tableY += rowHeight;
      });

      // 4. Totals & Remittance Section
      tableY += 10;

      // Left Box: Remittance / Bank Details
      const bankY = tableY;
      pdf.rect(36, bankY, 260, 96).fillAndStroke('#f8fafc', '#cbd5e1');
      pdf.fillColor('#475569').fontSize(8).font('Helvetica-Bold').text('BANK REMITTANCE DETAILS', 46, bankY + 8);
      
      const bank = company?.bankDetails || {};
      let bankTextY = bankY + 22;
      const drawBankLine = (lbl, val) => {
        pdf.fillColor('#64748b').fontSize(7.5).font('Helvetica').text(lbl, 46, bankTextY);
        pdf.fillColor('#0f172a').fontSize(7.5).font('Helvetica-Bold').text(val || '-', 120, bankTextY, { width: 165 });
        bankTextY += 12;
      };
      drawBankLine('Bank Name:', bank.bankName || 'HDFC Bank Ltd.');
      drawBankLine('Account Name:', bank.accountName || compName);
      drawBankLine('Account No:', bank.accountNumber || '50100123456789');
      drawBankLine('IFSC Code:', bank.ifscCode || 'HDFC0001234');
      drawBankLine('Branch:', bank.branch || 'Pune');
      if (bank.upiId) drawBankLine('UPI ID:', bank.upiId);

      // Right Box: Financial Calculation Totals
      pdf.rect(308, bankY, 251, 96).fillAndStroke('#ffffff', '#e2e8f0');
      let totalsY = bankY + 8;

      const drawTotalRow = (lbl, val, isBold = false, isAccent = false, customColor = null) => {
        pdf.fillColor(customColor || '#64748b').fontSize(isBold ? 8.5 : 7.5).font(isBold ? 'Helvetica-Bold' : 'Helvetica').text(lbl, 318, totalsY);
        pdf.fillColor(customColor || (isAccent ? primaryColor : '#0f172a')).fontSize(isBold ? 9 : 7.5).font(isBold ? 'Helvetica-Bold' : 'Helvetica').text(val, 420, totalsY, { width: 130, align: 'right' });
        totalsY += 13;
      };

      drawTotalRow('Subtotal:', fmtINR(doc.subtotal));
      if (doc.totalDiscount > 0) {
        drawTotalRow('Discount:', `- ${fmtINR(doc.totalDiscount)}`, false, false, '#dc2626');
      }
      if (doc.isInterState) {
        drawTotalRow('IGST:', fmtINR(doc.totalIgst));
      } else {
        drawTotalRow('CGST:', fmtINR(doc.totalCgst));
        drawTotalRow('SGST:', fmtINR(doc.totalSgst));
      }
      if (doc.roundOff) {
        drawTotalRow('Round Off:', fmtINR(doc.roundOff));
      }

      // Grand Total Highlight
      pdf.rect(308, totalsY - 2, 251, 20).fill('#0f172a');
      pdf.fillColor('#ffffff').fontSize(9.5).font('Helvetica-Bold').text('GRAND TOTAL:', 318, totalsY + 3);
      pdf.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold').text(fmtINR(doc.grandTotal), 420, totalsY + 3, { width: 130, align: 'right' });
      totalsY += 24;

      if (docType === 'Proforma Invoice' && doc.advanceRequired > 0) {
        drawTotalRow('Advance Required:', fmtINR(doc.advanceRequired), true, true);
      } else if (docType === 'Sales Invoice') {
        if (doc.advanceAdjusted > 0) drawTotalRow('Advance Adjusted:', `- ${fmtINR(doc.advanceAdjusted)}`);
        const bal = doc.balanceAmount !== undefined ? doc.balanceAmount : Math.max(0, (doc.grandTotal || 0) - (doc.advanceAdjusted || 0));
        drawTotalRow('Balance Payable:', fmtINR(bal), true, true);
      }

      // 5. Terms & Signatures Footer
      const footerY = Math.max(bankY + 104, 700);

      // Terms
      const terms = doc.termsAndConditions || company?.termsAndConditions || 'Payment due within terms. Goods once sold are subject to Pune jurisdiction.';
      pdf.fillColor('#64748b').fontSize(7).font('Helvetica-Bold').text('TERMS & CONDITIONS:', 36, footerY);
      pdf.fillColor('#475569').fontSize(6.5).font('Helvetica').text(terms, 36, footerY + 10, { width: 320, height: 35 });

      // Signatory
      pdf.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text(`For ${compName}`, 390, footerY + 10, { width: 169, align: 'center' });
      pdf.fillColor('#94a3b8').fontSize(7).font('Helvetica').text('(Authorized Signatory)', 390, footerY + 45, { width: 169, align: 'center' });

      // Bottom Bar
      pdf.rect(36, 785, 523, 20).fill('#f8fafc');
      pdf.fillColor('#94a3b8').fontSize(7).font('Helvetica').text(
        `${compName} | Address: ${compAddr} | Web: ${compWebsite} | Computer generated document.`,
        36,
        791,
        { width: 523, align: 'center' }
      );

      pdf.end();
    } catch (err) {
      reject(err);
    }
  });
};

