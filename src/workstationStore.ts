import type { EncryptedEmployeePublication } from "./domain";

const DATABASE_NAME = "eas-admin-toolkit-workstation-v1";
const DATABASE_VERSION = 1;
const TEMPLATE_STORE = "annual-template";
const PUBLICATION_STORE = "employee-publications";
const TEMPLATE_KEY = "approved";

export interface StoredAnnualTemplate {
  name: string;
  type: string;
  data: ArrayBuffer;
  savedAt: string;
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(TEMPLATE_STORE))
        database.createObjectStore(TEMPLATE_STORE);
      if (!database.objectStoreNames.contains(PUBLICATION_STORE))
        database.createObjectStore(PUBLICATION_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Local storage unavailable."));
  });
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

export function loadAnnualTemplate() {
  return requestValue<StoredAnnualTemplate | undefined>(
    TEMPLATE_STORE,
    "readonly",
    (store) => store.get(TEMPLATE_KEY),
  );
}

export async function saveAnnualTemplate(file: File) {
  const value: StoredAnnualTemplate = {
    name: file.name,
    type: file.type,
    data: await file.arrayBuffer(),
    savedAt: new Date().toISOString(),
  };
  await requestValue<IDBValidKey>(TEMPLATE_STORE, "readwrite", (store) =>
    store.put(value, TEMPLATE_KEY),
  );
  return value;
}

export function removeAnnualTemplate() {
  return requestValue<undefined>(TEMPLATE_STORE, "readwrite", (store) =>
    store.delete(TEMPLATE_KEY),
  );
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
