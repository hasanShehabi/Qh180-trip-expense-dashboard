import { getStore } from "@netlify/blobs";

const STORE_NAME = "trip-expenses";
const DATA_KEY = "shared-trip-data";

const defaultData = {
  expenses: [],
  repayments: [],
  settings: {},
  updatedAt: null,
};

export default async (request) => {
  const store = getStore(STORE_NAME);

  if (request.method === "GET") {
    const data = normalizeStoredData((await store.get(DATA_KEY, { type: "json" })) || defaultData);
    return json(data);
  }

  if (request.method === "PUT") {
    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const data = normalizePayload(payload);
    await store.setJSON(DATA_KEY, data);
    return json(data);
  }

  return json({ error: "Method not allowed" }, 405, {
    Allow: "GET, PUT",
  });
};

function normalizePayload(payload) {
  return {
    expenses: Array.isArray(payload.expenses) ? payload.expenses : [],
    repayments: Array.isArray(payload.repayments) ? payload.repayments : [],
    settings: payload.settings && typeof payload.settings === "object" ? payload.settings : {},
    updatedAt: new Date().toISOString(),
  };
}

function normalizeStoredData(data) {
  return {
    expenses: Array.isArray(data.expenses) ? data.expenses : [],
    repayments: Array.isArray(data.repayments) ? data.repayments : [],
    settings: data.settings && typeof data.settings === "object" ? data.settings : {},
    updatedAt: data.updatedAt || null,
  };
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}
