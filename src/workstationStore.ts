import type {
  EncryptedEmployeePublication,
  StoredJobRegister,
  StoredFinancialYearWorkbook,
} from "./domain";

const DATABASE_NAME = "eas-admin-toolkit-workstation-v1";
const DATABASE_VERSION = 4;
const LEGACY_TEMPLATE_STORE = "annual-template";
const PUBLICATION_STORE = "employee-publications";
const FINANCIAL_YEAR_STORE = "financial-year-workbooks";
const JOB_REGISTER_STORE = "job-register";

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (database.objectStoreNames.contains(LEGACY_TEMPLATE_STORE))
        database.deleteObjectStore(LEGACY_TEMPLATE_STORE);
      if (!database.objectStoreNames.contains(PUBLICATION_STORE))
        database.createObjectStore(PUBLICATION_STORE);
      if (!database.objectStoreNames.contains(FINANCIAL_YEAR_STORE))
        database.createObjectStore(FINANCIAL_YEAR_STORE);
      if (!database.objectStoreNames.contains(JOB_REGISTER_STORE))
        database.createObjectStore(JOB_REGISTER_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Local storage unavailable."));
  });
}

export async function migrateWorkstationStore() {
  const database = await openDatabase();
  database.close();
}

async function requestValue<T>(
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = operation(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Local storage operation failed."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () =>
      reject(
        transaction.error ?? new Error("Local storage transaction failed."),
      );
  });
}

export function saveEncryptedPublication(
  publication: EncryptedEmployeePublication,
) {
  return requestValue<IDBValidKey>(PUBLICATION_STORE, "readwrite", (store) =>
    store.put(publication, publication.month),
  );
}

export function listEncryptedPublications() {
  return requestValue<EncryptedEmployeePublication[]>(
    PUBLICATION_STORE,
    "readonly",
    (store) => store.getAll(),
  );
}

export function listFinancialYearWorkbooks() {
  return requestValue<StoredFinancialYearWorkbook[]>(
    FINANCIAL_YEAR_STORE,
    "readonly",
    (store) => store.getAll(),
  );
}

export function loadJobRegister() {
  return requestValue<StoredJobRegister | undefined>(
    JOB_REGISTER_STORE,
    "readonly",
    (store) => store.get("latest"),
  );
}

export function saveJobRegister(jobRegister: StoredJobRegister) {
  return requestValue<IDBValidKey>(JOB_REGISTER_STORE, "readwrite", (store) =>
    store.put(jobRegister, "latest"),
  );
}

export async function saveFinancialYearWorkbook(
  workbook: StoredFinancialYearWorkbook,
) {
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(FINANCIAL_YEAR_STORE, "readwrite");
    const store = transaction.objectStore(FINANCIAL_YEAR_STORE);
    const getAll = store.getAll();
    getAll.onsuccess = () => {
      if (workbook.role === "current") {
        for (const item of getAll.result as StoredFinancialYearWorkbook[])
          if (
            item.role === "current" &&
            item.financialYear !== workbook.financialYear
          )
            store.put(
              {
                ...item,
                role: "historical",
                inspection: {
                  ...item.inspection,
                  source: { ...item.inspection.source, role: "historical" },
                },
              },
              item.financialYear,
            );
      }
      store.put(workbook, workbook.financialYear);
    };
    getAll.onerror = () =>
      reject(getAll.error ?? new Error("Saved workbook list is unavailable."));
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(
        transaction.error ?? new Error("The workbook could not be saved."),
      );
    };
  });
}
