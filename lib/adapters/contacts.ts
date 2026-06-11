// DB rows → contact-facing frontend shapes. Pure — no Supabase imports.

import type { DbContact, DbCompanyContact } from "@/types/db";
import type { Contact, CompanyContact } from "@/lib/contacts";

export function toContact(row: DbContact): Contact {
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    firm: row.firm,
    email: row.email,
    phone: row.phone,
    linkedinUrl: row.linkedin_url,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

// Join row + its embedded contact → a company-attached contact.
export function toCompanyContact(
  link: DbCompanyContact,
  contact: DbContact
): CompanyContact {
  return {
    ...toContact(contact),
    linkId: link.id,
    role: link.role,
  };
}
