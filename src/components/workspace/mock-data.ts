export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type KeyValue = { key: string; value: string };

export type Auth =
  | { type: "none" }
  | { type: "bearer"; token: string }
  | { type: "basic"; username: string; password: string };

export type RequestResponse = {
  status: number;
  timeMs: number;
  sizeBytes: number;
  body: string;
  headers: KeyValue[];
};

export type RequestNode = {
  kind: "request";
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  params: KeyValue[];
  headers: KeyValue[];
  auth: Auth;
  body: string;
  scripts: { pre: string; post: string };
  response: RequestResponse;
};

export type FolderNode = {
  kind: "folder";
  id: string;
  name: string;
  children: TreeNode[];
};

export type TreeNode = FolderNode | RequestNode;

const tokenRequest: RequestNode = {
  kind: "request",
  id: "r-token",
  name: "/oauth/token",
  method: "POST",
  url: "{{baseUrl}}/oauth/token",
  params: [
    { key: "grant_type", value: "client_credentials" },
    { key: "scope", value: "read write" },
  ],
  headers: [
    { key: "Content-Type", value: "application/x-www-form-urlencoded" },
  ],
  auth: { type: "bearer", token: "ey.mock.token" },
  body: '{\n  "grant_type": "client_credentials"\n}',
  scripts: { pre: "// pre-request script", post: "// post-response script" },
  response: {
    status: 200,
    timeMs: 142,
    sizeBytes: 248,
    body: '{\n  "access_token": "ey.mock.token",\n  "expires_in": 3600\n}',
    headers: [
      { key: "Content-Type", value: "application/json" },
      { key: "Cache-Control", value: "no-store" },
    ],
  },
};

const refreshRequest: RequestNode = {
  kind: "request",
  id: "r-refresh",
  name: "/oauth/refresh",
  method: "GET",
  url: "{{baseUrl}}/oauth/refresh",
  params: [],
  headers: [{ key: "Accept", value: "application/json" }],
  auth: { type: "bearer", token: "ey.refresh.token" },
  body: "",
  scripts: { pre: "", post: "" },
  response: {
    status: 200,
    timeMs: 96,
    sizeBytes: 180,
    body: '{\n  "access_token": "ey.new.token"\n}',
    headers: [{ key: "Content-Type", value: "application/json" }],
  },
};

const userinfoRequest: RequestNode = {
  kind: "request",
  id: "r-userinfo",
  name: "/oauth/userinfo",
  method: "GET",
  url: "{{baseUrl}}/oauth/userinfo",
  params: [],
  headers: [{ key: "Authorization", value: "Bearer ey.mock.token" }],
  auth: { type: "bearer", token: "ey.mock.token" },
  body: "",
  scripts: { pre: "", post: "" },
  response: {
    status: 200,
    timeMs: 71,
    sizeBytes: 132,
    body: '{\n  "sub": "user-1",\n  "name": "Ada"\n}',
    headers: [{ key: "Content-Type", value: "application/json" }],
  },
};

const getUserRequest: RequestNode = {
  kind: "request",
  id: "r-getuser",
  name: "/users/:id",
  method: "GET",
  url: "{{baseUrl}}/users/:id",
  params: [{ key: "expand", value: "roles" }],
  headers: [{ key: "Accept", value: "application/json" }],
  auth: { type: "basic", username: "admin", password: "s3cret" },
  body: "",
  scripts: { pre: "", post: "" },
  response: {
    status: 200,
    timeMs: 64,
    sizeBytes: 210,
    body: '{\n  "id": 1,\n  "name": "Ada"\n}',
    headers: [{ key: "Content-Type", value: "application/json" }],
  },
};

const invoicesRequest: RequestNode = {
  kind: "request",
  id: "r-invoices",
  name: "/billing/invoices",
  method: "GET",
  url: "{{baseUrl}}/billing/invoices",
  params: [{ key: "status", value: "open" }],
  headers: [{ key: "Accept", value: "application/json" }],
  auth: { type: "bearer", token: "ey.billing.token" },
  body: "",
  scripts: { pre: "", post: "" },
  response: {
    status: 200,
    timeMs: 188,
    sizeBytes: 540,
    body: '{\n  "invoices": []\n}',
    headers: [{ key: "Content-Type", value: "application/json" }],
  },
};

const chargeRequest: RequestNode = {
  kind: "request",
  id: "r-charge",
  name: "/billing/charge",
  method: "POST",
  url: "{{baseUrl}}/billing/charge",
  params: [],
  headers: [{ key: "Content-Type", value: "application/json" }],
  auth: { type: "bearer", token: "ey.billing.token" },
  body: '{\n  "amount": 1999,\n  "currency": "eur"\n}',
  scripts: { pre: "", post: "" },
  response: {
    status: 201,
    timeMs: 233,
    sizeBytes: 96,
    body: '{\n  "charge_id": "ch_1"\n}',
    headers: [{ key: "Content-Type", value: "application/json" }],
  },
};

const healthRequest: RequestNode = {
  kind: "request",
  id: "r-health",
  name: "/health",
  method: "GET",
  url: "{{baseUrl}}/health",
  params: [],
  headers: [],
  auth: { type: "none" },
  body: "",
  scripts: { pre: "", post: "" },
  response: {
    status: 200,
    timeMs: 12,
    sizeBytes: 18,
    body: '{\n  "ok": true\n}',
    headers: [{ key: "Content-Type", value: "application/json" }],
  },
};

export const mockTree: TreeNode[] = [
  {
    kind: "folder",
    id: "f-auth",
    name: "auth",
    children: [
      {
        kind: "folder",
        id: "f-oauth",
        name: "oauth",
        children: [
          {
            kind: "folder",
            id: "f-tokens",
            name: "tokens",
            children: [tokenRequest, refreshRequest],
          },
          userinfoRequest,
        ],
      },
    ],
  },
  {
    kind: "folder",
    id: "f-users",
    name: "users",
    children: [getUserRequest],
  },
  {
    kind: "folder",
    id: "f-billing",
    name: "billing",
    children: [invoicesRequest, chargeRequest],
  },
  healthRequest,
];

export const mockConsoleLines: string[] = [
  "[12:00:00] Ready.",
  "→ POST {{baseUrl}}/oauth/token  200",
  "← 142ms · 248B",
  "[script] pre-request ok",
];
