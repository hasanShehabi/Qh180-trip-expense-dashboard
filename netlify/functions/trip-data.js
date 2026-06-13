import { getStore } from "@netlify/blobs";

const STORE_NAME = "trip-expenses";
const DATA_KEY = "shared-trip-data";

const defaultData = {
  expenses: [],
  settings: {},
  updatedAt: null,
};

export default async (request) => {
  const store = getStore(STORE_NAME);

  if (request.method === "GET") {
    const data = (await store.get(DATA_KEY, { type: "json" })) || defaultData;
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
    settings: payload.settings && typeof payload.settings === "object" ? payload.settings : {},
    updatedAt: new Date().toISOString(),
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
