import { db } from "./db";
import { companies, accounts, transactions, invoices } from "@shared/schema";

async function seedDatabase() {
  try {
    console.log("Seeding database with sample data...");

    // Create a sample company
    const [company] = await db.insert(companies).values({
      name: "Acme Technologies AS",
      orgNumber: "123456789",
      address: "Storgata 1",
      city: "Oslo",
      postalCode: "0001",
      country: "NO",
      phone: "+47 12345678",
      website: "https://acme.no",
      industry: "Technology",
      kycStatus: "verified",
      isActive: true,
    }).returning();

    console.log("Created company:", company.name);

    // Create sample accounts
    const [mainAccount] = await db.insert(accounts).values({
      companyId: company.id,
      accountNumber: "NO1234567890123",
      accountType: "business",
      balance: "125750.00",
      currency: "NOK",
      isActive: true,
    }).returning();

    const [savingsAccount] = await db.insert(accounts).values({
      companyId: company.id,
      accountNumber: "NO1234567890124",
      accountType: "savings",
      balance: "50000.00",
      currency: "NOK",
      isActive: true,
    }).returning();

    console.log("Created accounts");

    // Create sample transactions
    const sampleTransactions = [
      {
        accountId: mainAccount.id,
        type: "credit",
        amount: "15000.00",
        description: "Kundeinnbetaling - Faktura #2024-001",
        counterpartyName: "Kundefirma AS",
        counterpartyAccount: "NO9876543210987",
        reference: "INV-2024-001",
        status: "completed",
        transactionDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      },
      {
        accountId: mainAccount.id,
        type: "debit",
        amount: "8500.00",
        description: "Lønn desember 2024",
        counterpartyName: "Ansatte",
        status: "completed",
        transactionDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      },
      {
        accountId: mainAccount.id,
        type: "credit",
        amount: "22000.00",
        description: "Abonnementsinntekt - Q4 2024",
        counterpartyName: "Stor Kunde AS",
        status: "completed",
        transactionDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      },
      {
        accountId: mainAccount.id,
        type: "debit",
        amount: "2500.00",
        description: "Fakturabetaling - KID: 1234567890123",
        counterpartyName: "Leverandør AS",
        kidNumber: "1234567890123",
        status: "completed",
        transactionDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
      },
      {
        accountId: mainAccount.id,
        type: "debit",
        amount: "12000.00",
        description: "Husleie - Januar 2025",
        counterpartyName: "Eiendomsselskap AS",
        status: "completed",
        transactionDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      },
    ];

    await db.insert(transactions).values(sampleTransactions);
    console.log("Created sample transactions");

    // Create sample invoices
    const sampleInvoices = [
      {
        companyId: company.id,
        invoiceNumber: "INV-2025-001",
        kidNumber: "9876543210987",
        amount: "5500.00",
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        status: "pending",
        creditorName: "Regnskapsfirma AS",
        creditorAccount: "NO1111222233334",
        description: "Regnskapsbistand januar 2025",
      },
      {
        companyId: company.id,
        invoiceNumber: "INV-2025-002", 
        kidNumber: "5432109876543",
        amount: "3200.00",
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
        status: "pending",
        creditorName: "IT-Support AS",
        creditorAccount: "NO5555666677778",
        description: "IT-support og vedlikehold",
      },
      {
        companyId: company.id,
        invoiceNumber: "INV-2024-999",
        kidNumber: "1111222233334",
        amount: "1800.00",
        dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago (overdue)
        status: "pending",
        creditorName: "Forsikringsselskap AS",
        creditorAccount: "NO9999888877776",
        description: "Bedriftsforsikring Q4 2024",
      },
    ];

    await db.insert(invoices).values(sampleInvoices);
    console.log("Created sample invoices");

    console.log("Database seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
}

// Run the seeding function
seedDatabase();

export { seedDatabase };