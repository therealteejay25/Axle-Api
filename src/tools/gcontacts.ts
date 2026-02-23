import { z } from "zod";
import { logger } from "../services/logger";
import { BaseGoogleTool } from "./base";

// ============================================
// GOOGLE CONTACTS TOOL SUITE - COMPREHENSIVE
// ============================================

export class ContactsToolSuite extends BaseGoogleTool {
  constructor(userId: string) {
    super(userId);
  }

  // List contacts
  createListTool() {
    return this.createTool(
      "gcontacts_list",
      "List all contacts with optional pageToken and pageSize",
      z.object({
        pageSize: z.number().min(1).max(1000).default(100).optional(),
        pageToken: z.string().optional(),
      }),
      async ({ pageSize, pageToken }) => {
        try {
          logger.info(`[CONTACTS] Listing contacts`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const people = google.people({ version: "v1", auth: oauth2Client });

            return await people.people.connections.list({
              resourceName: "people/me",
              pageSize,
              pageToken,
              personFields: "names,emailAddresses,phoneNumbers,organizations,biographies",
            });
          });

          const contacts = result.data.connections || [];
          logger.info(`[CONTACTS] Found ${contacts.length} contacts`);

          return {
            success: true,
            data: {
              contacts: contacts.map((contact: any) => ({
                resourceName: contact.resourceName,
                name: contact.names?.[0]?.displayName,
                email: contact.emailAddresses?.[0]?.value,
                phone: contact.phoneNumbers?.[0]?.value,
                company: contact.organizations?.[0]?.name,
              })),
              totalCount: contacts.length,
              nextPageToken: result.data.nextPageToken,
            },
          };
        } catch (error: any) {
          logger.error("[CONTACTS] List failed:", error);
          return {
            success: false,
            error: error.message || "Failed to list contacts",
          };
        }
      }
    );
  }

  // Search contacts
  createSearchTool() {
    return this.createTool(
      "gcontacts_search",
      "Search contacts by name, email, or phone",
      z.object({
        query: z.string().min(1, "Search query is required"),
        pageSize: z.number().min(1).max(30).default(10).optional(),
      }),
      async ({ query, pageSize }) => {
        try {
          logger.info(`[CONTACTS] Searching contacts: ${query}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const people = google.people({ version: "v1", auth: oauth2Client });

            return await people.people.searchContacts({
              query,
              pageSize,
              readMask: "names,emailAddresses,phoneNumbers,organizations",
            });
          });

          const contacts = result.data.results || [];
          logger.info(`[CONTACTS] Found ${contacts.length} matching contacts`);

          return {
            success: true,
            data: {
              contacts: contacts.map((item: any) => ({
                resourceName: item.person?.resourceName,
                name: item.person?.names?.[0]?.displayName,
                email: item.person?.emailAddresses?.[0]?.value,
                phone: item.person?.phoneNumbers?.[0]?.value,
              })),
              totalCount: contacts.length,
            },
          };
        } catch (error: any) {
          logger.error("[CONTACTS] Search failed:", error);
          return {
            success: false,
            error: error.message || "Failed to search contacts",
          };
        }
      }
    );
  }

  // Get contact
  createGetTool() {
    return this.createTool(
      "gcontacts_get",
      "Get a contact by resourceName",
      z.object({
        resourceName: z.string().min(1, "Resource name is required"),
      }),
      async ({ resourceName }) => {
        try {
          logger.info(`[CONTACTS] Getting contact: ${resourceName}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const people = google.people({ version: "v1", auth: oauth2Client });

            return await people.people.get({
              resourceName,
              personFields: "names,emailAddresses,phoneNumbers,organizations,biographies,addresses,birthdays",
            });
          });

          logger.info(`[CONTACTS] Retrieved contact`);

          return {
            success: true,
            data: {
              resourceName: result.data.resourceName,
              name: result.data.names?.[0],
              emails: result.data.emailAddresses,
              phones: result.data.phoneNumbers,
              organizations: result.data.organizations,
              biography: result.data.biographies?.[0]?.value,
              addresses: result.data.addresses,
              birthdays: result.data.birthdays,
            },
          };
        } catch (error: any) {
          logger.error("[CONTACTS] Get failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get contact",
          };
        }
      }
    );
  }

  // Create contact
  createCreateTool() {
    return this.createTool(
      "gcontacts_create",
      "Create a new contact with name, email, phone, company, notes",
      z.object({
        givenName: z.string().min(1, "Given name is required"),
        familyName: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        company: z.string().optional(),
        jobTitle: z.string().optional(),
        notes: z.string().optional(),
      }),
      async ({ givenName, familyName, email, phone, company, jobTitle, notes }) => {
        try {
          logger.info(`[CONTACTS] Creating contact: ${givenName} ${familyName || ""}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const people = google.people({ version: "v1", auth: oauth2Client });

            const contactData: any = {
              names: [{ givenName, familyName }],
            };

            if (email) {
              contactData.emailAddresses = [{ value: email }];
            }
            if (phone) {
              contactData.phoneNumbers = [{ value: phone }];
            }
            if (company || jobTitle) {
              contactData.organizations = [{ name: company, title: jobTitle }];
            }
            if (notes) {
              contactData.biographies = [{ value: notes, contentType: "TEXT_PLAIN" }];
            }

            return await people.people.createContact({
              requestBody: contactData,
            });
          });

          logger.info(`[CONTACTS] Contact created: ${result.data.resourceName}`);

          return {
            success: true,
            data: {
              resourceName: result.data.resourceName,
              name: result.data.names?.[0]?.displayName,
            },
          };
        } catch (error: any) {
          logger.error("[CONTACTS] Create failed:", error);
          return {
            success: false,
            error: error.message || "Failed to create contact",
          };
        }
      }
    );
  }

  // Update contact
  createUpdateTool() {
    return this.createTool(
      "gcontacts_update",
      "Update any field of an existing contact",
      z.object({
        resourceName: z.string().min(1, "Resource name is required"),
        givenName: z.string().optional(),
        familyName: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        company: z.string().optional(),
        jobTitle: z.string().optional(),
        notes: z.string().optional(),
      }),
      async ({ resourceName, givenName, familyName, email, phone, company, jobTitle, notes }) => {
        try {
          logger.info(`[CONTACTS] Updating contact: ${resourceName}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const people = google.people({ version: "v1", auth: oauth2Client });

            // Get existing contact
            const existing = await people.people.get({
              resourceName,
              personFields: "names,emailAddresses,phoneNumbers,organizations,biographies",
            });

            const updateData: any = {
              resourceName,
              etag: existing.data.etag,
              names: existing.data.names || [],
              emailAddresses: existing.data.emailAddresses || [],
              phoneNumbers: existing.data.phoneNumbers || [],
              organizations: existing.data.organizations || [],
              biographies: existing.data.biographies || [],
            };

            if (givenName || familyName) {
              updateData.names = [{ 
                givenName: givenName || existing.data.names?.[0]?.givenName,
                familyName: familyName || existing.data.names?.[0]?.familyName,
              }];
            }
            if (email) {
              updateData.emailAddresses = [{ value: email }];
            }
            if (phone) {
              updateData.phoneNumbers = [{ value: phone }];
            }
            if (company || jobTitle) {
              updateData.organizations = [{ name: company, title: jobTitle }];
            }
            if (notes) {
              updateData.biographies = [{ value: notes, contentType: "TEXT_PLAIN" }];
            }

            return await people.people.updateContact({
              resourceName,
              updatePersonFields: "names,emailAddresses,phoneNumbers,organizations,biographies",
              requestBody: updateData,
            });
          });

          logger.info(`[CONTACTS] Contact updated successfully`);

          return {
            success: true,
            message: "Contact updated successfully",
          };
        } catch (error: any) {
          logger.error("[CONTACTS] Update failed:", error);
          return {
            success: false,
            error: error.message || "Failed to update contact",
          };
        }
      }
    );
  }

  // Delete contact
  createDeleteTool() {
    return this.createTool(
      "gcontacts_delete",
      "Delete a contact",
      z.object({
        resourceName: z.string().min(1, "Resource name is required"),
      }),
      async ({ resourceName }) => {
        try {
          logger.info(`[CONTACTS] Deleting contact: ${resourceName}`);

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const people = google.people({ version: "v1", auth: oauth2Client });

            return await people.people.deleteContact({
              resourceName,
            });
          });

          logger.info(`[CONTACTS] Contact deleted successfully`);

          return {
            success: true,
            message: "Contact deleted successfully",
          };
        } catch (error: any) {
          logger.error("[CONTACTS] Delete failed:", error);
          return {
            success: false,
            error: error.message || "Failed to delete contact",
          };
        }
      }
    );
  }

  // List groups
  createListGroupsTool() {
    return this.createTool(
      "gcontacts_list_groups",
      "List all contact groups/labels",
      z.object({
        pageSize: z.number().min(1).max(1000).default(100).optional(),
        pageToken: z.string().optional(),
      }),
      async ({ pageSize, pageToken }) => {
        try {
          logger.info(`[CONTACTS] Listing contact groups`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const people = google.people({ version: "v1", auth: oauth2Client });

            return await people.contactGroups.list({
              pageSize,
              pageToken,
            });
          });

          const groups = result.data.contactGroups || [];
          logger.info(`[CONTACTS] Found ${groups.length} groups`);

          return {
            success: true,
            data: {
              groups: groups.map((group: any) => ({
                resourceName: group.resourceName,
                name: group.name,
                memberCount: group.memberCount,
                groupType: group.groupType,
              })),
              totalCount: groups.length,
              nextPageToken: result.data.nextPageToken,
            },
          };
        } catch (error: any) {
          logger.error("[CONTACTS] List groups failed:", error);
          return {
            success: false,
            error: error.message || "Failed to list groups",
          };
        }
      }
    );
  }

  // Create group
  createCreateGroupTool() {
    return this.createTool(
      "gcontacts_create_group",
      "Create a contact group",
      z.object({
        name: z.string().min(1, "Group name is required"),
      }),
      async ({ name }) => {
        try {
          logger.info(`[CONTACTS] Creating group: ${name}`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const people = google.people({ version: "v1", auth: oauth2Client });

            return await people.contactGroups.create({
              requestBody: {
                contactGroup: {
                  name,
                },
              },
            });
          });

          logger.info(`[CONTACTS] Group created: ${result.data.resourceName}`);

          return {
            success: true,
            data: {
              resourceName: result.data.resourceName,
              name: result.data.name,
            },
          };
        } catch (error: any) {
          logger.error("[CONTACTS] Create group failed:", error);
          return {
            success: false,
            error: error.message || "Failed to create group",
          };
        }
      }
    );
  }

  // Add to group
  createAddToGroupTool() {
    return this.createTool(
      "gcontacts_add_to_group",
      "Add contact to a group",
      z.object({
        groupResourceName: z.string().min(1, "Group resource name is required"),
        contactResourceName: z.string().min(1, "Contact resource name is required"),
      }),
      async ({ groupResourceName, contactResourceName }) => {
        try {
          logger.info(`[CONTACTS] Adding contact to group`);

          await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const people = google.people({ version: "v1", auth: oauth2Client });

            return await people.contactGroups.members.modify({
              resourceName: groupResourceName,
              requestBody: {
                resourceNamesToAdd: [contactResourceName],
              },
            });
          });

          logger.info(`[CONTACTS] Contact added to group successfully`);

          return {
            success: true,
            message: "Contact added to group successfully",
          };
        } catch (error: any) {
          logger.error("[CONTACTS] Add to group failed:", error);
          return {
            success: false,
            error: error.message || "Failed to add contact to group",
          };
        }
      }
    );
  }

  // Get other contacts
  createGetOtherContactsTool() {
    return this.createTool(
      "gcontacts_get_other_contacts",
      'List contacts from "Other Contacts" (auto-created from emails)',
      z.object({
        pageSize: z.number().min(1).max(1000).default(100).optional(),
        pageToken: z.string().optional(),
      }),
      async ({ pageSize, pageToken }) => {
        try {
          logger.info(`[CONTACTS] Getting other contacts`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const people = google.people({ version: "v1", auth: oauth2Client });

            return await people.otherContacts.list({
              pageSize,
              pageToken,
              readMask: "names,emailAddresses",
            });
          });

          const contacts = result.data.otherContacts || [];
          logger.info(`[CONTACTS] Found ${contacts.length} other contacts`);

          return {
            success: true,
            data: {
              contacts: contacts.map((contact: any) => ({
                resourceName: contact.resourceName,
                name: contact.names?.[0]?.displayName,
                email: contact.emailAddresses?.[0]?.value,
              })),
              totalCount: contacts.length,
              nextPageToken: result.data.nextPageToken,
            },
          };
        } catch (error: any) {
          logger.error("[CONTACTS] Get other contacts failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get other contacts",
          };
        }
      }
    );
  }

  // Get profile
  createGetProfileTool() {
    return this.createTool(
      "gcontacts_get_profile",
      "Get the authenticated user's own profile",
      z.object({}),
      async () => {
        try {
          logger.info(`[CONTACTS] Getting user profile`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const people = google.people({ version: "v1", auth: oauth2Client });

            return await people.people.get({
              resourceName: "people/me",
              personFields: "names,emailAddresses,phoneNumbers,photos,coverPhotos",
            });
          });

          logger.info(`[CONTACTS] Retrieved user profile`);

          return {
            success: true,
            data: {
              resourceName: result.data.resourceName,
              name: result.data.names?.[0]?.displayName,
              email: result.data.emailAddresses?.[0]?.value,
              phone: result.data.phoneNumbers?.[0]?.value,
              photo: result.data.photos?.[0]?.url,
            },
          };
        } catch (error: any) {
          logger.error("[CONTACTS] Get profile failed:", error);
          return {
            success: false,
            error: error.message || "Failed to get profile",
          };
        }
      }
    );
  }

  // Batch create
  createBatchCreateTool() {
    return this.createTool(
      "gcontacts_batch_create",
      "Create multiple contacts at once",
      z.object({
        contacts: z.array(z.object({
          givenName: z.string().min(1),
          familyName: z.string().optional(),
          email: z.string().email().optional(),
          phone: z.string().optional(),
        })).min(1, "At least one contact is required"),
      }),
      async ({ contacts }) => {
        try {
          logger.info(`[CONTACTS] Batch creating ${contacts.length} contacts`);

          const result = await this.executeGoogleRequest(async (oauth2Client) => {
            const { google } = await import("googleapis");
            const people = google.people({ version: "v1", auth: oauth2Client });

            return await people.people.batchCreateContacts({
              requestBody: {
                contacts: contacts.map(contact => ({
                  contactPerson: {
                    names: [{ givenName: contact.givenName, familyName: contact.familyName }],
                    emailAddresses: contact.email ? [{ value: contact.email }] : undefined,
                    phoneNumbers: contact.phone ? [{ value: contact.phone }] : undefined,
                  },
                })),
              },
            });
          });

          const created = result.data.createdPeople || [];
          logger.info(`[CONTACTS] Created ${created.length} contacts`);

          return {
            success: true,
            data: {
              createdCount: created.length,
              contacts: created.map((item: any) => ({
                resourceName: item.person?.resourceName,
                name: item.person?.names?.[0]?.displayName,
              })),
            },
          };
        } catch (error: any) {
          logger.error("[CONTACTS] Batch create failed:", error);
          return {
            success: false,
            error: error.message || "Failed to batch create contacts",
          };
        }
      }
    );
  }
}

// ============================================
// FACTORY FUNCTIONS FOR REGISTRY
// ============================================

export const createListTool = (userId: string) =>
  new ContactsToolSuite(userId).createListTool();

export const createSearchTool = (userId: string) =>
  new ContactsToolSuite(userId).createSearchTool();

export const createGetTool = (userId: string) =>
  new ContactsToolSuite(userId).createGetTool();

export const createCreateTool = (userId: string) =>
  new ContactsToolSuite(userId).createCreateTool();

export const createUpdateTool = (userId: string) =>
  new ContactsToolSuite(userId).createUpdateTool();

export const createDeleteTool = (userId: string) =>
  new ContactsToolSuite(userId).createDeleteTool();

export const createListGroupsTool = (userId: string) =>
  new ContactsToolSuite(userId).createListGroupsTool();

export const createCreateGroupTool = (userId: string) =>
  new ContactsToolSuite(userId).createCreateGroupTool();

export const createAddToGroupTool = (userId: string) =>
  new ContactsToolSuite(userId).createAddToGroupTool();

export const createGetOtherContactsTool = (userId: string) =>
  new ContactsToolSuite(userId).createGetOtherContactsTool();

export const createGetProfileTool = (userId: string) =>
  new ContactsToolSuite(userId).createGetProfileTool();

export const createBatchCreateTool = (userId: string) =>
  new ContactsToolSuite(userId).createBatchCreateTool();

// ============================================
// MAIN EXPORT FUNCTION
// ============================================
export const createContactsTools = (userId: string) => {
  const suite = new ContactsToolSuite(userId);
  return [
    suite.createListTool(),
    suite.createSearchTool(),
    suite.createGetTool(),
    suite.createCreateTool(),
    suite.createUpdateTool(),
    suite.createDeleteTool(),
    suite.createListGroupsTool(),
    suite.createCreateGroupTool(),
    suite.createAddToGroupTool(),
    suite.createGetOtherContactsTool(),
    suite.createGetProfileTool(),
    suite.createBatchCreateTool(),
  ];
};
