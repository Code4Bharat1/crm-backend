import Customer from '../models/Customer.js';

export const WON_STAGE = 'Won';

const escapeRegex = (str = '') => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Pull the first email address out of free text (lead notes usually carry it). */
const extractEmail = (text = '') => {
  const match = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  return match ? match[0] : undefined;
};

/** Pull the first Indian-style phone number out of free text. */
const extractPhone = (text = '') => {
  const match = text.match(/(?:\+91[-\s]?)?[6-9]\d{9}/);
  return match ? match[0] : undefined;
};

/**
 * Converts a Won lead into a customer record.
 *
 * Idempotent by design — a lead that already carries a convertedCustomerId, or whose
 * customerName matches an existing customer, links to that record instead of creating
 * a duplicate. Mutates and saves the lead with the link, so callers get a lead document
 * that already reflects the conversion.
 *
 * @param {import('mongoose').Document} lead - the lead that has just reached the Won stage
 * @returns {Promise<{ customer: object, created: boolean, alreadyConverted: boolean }>}
 */
export const convertLeadToCustomer = async (lead) => {
  // 1. Already converted — return the linked customer untouched.
  if (lead.convertedCustomerId) {
    const existing = await Customer.findOne({ id: lead.convertedCustomerId });
    if (existing) {
      return { customer: existing, created: false, alreadyConverted: true };
    }
    // Link points at a customer that no longer exists — fall through and rebuild it.
  }

  const name = (lead.customerName || '').trim();
  if (!name) {
    throw new Error('Lead has no customerName — cannot create a customer from it.');
  }

  // 2. A customer with this name may already exist (repeat business, manual entry).
  let customer = await Customer.findOne({
    name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
  });
  let created = false;

  if (customer) {
    // Promote a placeholder "Lead" record to a real active customer.
    if (customer.status === 'Lead') customer.status = 'Active';
    if (!customer.area && lead.area) customer.area = lead.area;
    if (!customer.salesPerson && lead.salesperson) customer.salesPerson = lead.salesperson;
    await customer.save();
  } else {
    const notes = lead.notes || '';
    customer = new Customer({
      name,
      status: 'Active',
      area: lead.area,
      salesPerson: lead.salesperson,
      contactPerson: {
        name,
        email: extractEmail(notes),
        phone: extractPhone(notes),
      },
      notes: `Auto-created from won lead ${lead.id} on ${new Date().toLocaleString()}.` +
        (notes ? `\n\n--- Lead notes ---\n${notes}` : ''),
    });
    await customer.save();
    created = true;
  }

  // 3. Link the lead back to the customer so this never runs twice.
  lead.convertedCustomerId = customer.id;
  lead.convertedAt = new Date();
  lead.notes = (lead.notes || '') +
    `\n\n[Won] Lead converted to customer ${customer.id} on ${new Date().toLocaleString()}.`;
  await lead.save();

  return { customer, created, alreadyConverted: false };
};
