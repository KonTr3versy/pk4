const DEFAULT_BASE_URL = process.env.ATTACK_TAXII_BASE_URL || 'https://attack-taxii.mitre.org/api/v21';

const DOMAIN_COLLECTIONS = {
  enterprise: process.env.ATTACK_ENTERPRISE_COLLECTION_ID || 'x-mitre-collection--1f5f1533-f617-4ca8-9ab4-6a02367fa019',
  mobile: process.env.ATTACK_MOBILE_COLLECTION_ID || 'x-mitre-collection--f9e2a3a7-d6a2-4e46-b4c7-16e7b5f9f6f2',
  ics: process.env.ATTACK_ICS_COLLECTION_ID || 'x-mitre-collection--90c00720-636b-4485-b342-8751d232bf09',
};

const TAXII_HEADERS = {
  Accept: 'application/taxii+json;version=2.1',
  'Content-Type': 'application/taxii+json;version=2.1',
};

async function fetchJson(url) {
  const response = await fetch(url, { headers: TAXII_HEADERS });
  if (!response.ok) {
    throw new Error(`TAXII request failed (${response.status} ${response.statusText}) for ${url}`);
  }
  return response.json();
}

async function listCollections(baseUrl = DEFAULT_BASE_URL) {
  return fetchJson(`${baseUrl}/collections/`);
}

async function fetchCollectionObjects({ domain, addedAfter }) {
  const collectionId = DOMAIN_COLLECTIONS[domain];
  if (!collectionId) {
    throw new Error(`Unsupported ATT&CK domain: ${domain}`);
  }

  const params = new URLSearchParams();
  if (addedAfter) {
    params.set('added_after', addedAfter);
  }

  const base = `${DEFAULT_BASE_URL}/collections/${collectionId}/objects/`;
  let nextUrl = params.toString() ? `${base}?${params}` : base;
  const objects = [];

  while (nextUrl) {
    const payload = await fetchJson(nextUrl);
    if (Array.isArray(payload.objects)) {
      objects.push(...payload.objects);
    }

    if (payload.more && payload.next) {
      const nextParams = new URLSearchParams();
      nextParams.set('next', payload.next);
      nextUrl = `${base}?${nextParams.toString()}`;
    } else {
      nextUrl = null;
    }
  }

  return { objects, collectionId };
}

module.exports = {
  DEFAULT_BASE_URL,
  DOMAIN_COLLECTIONS,
  listCollections,
  fetchCollectionObjects,
};
