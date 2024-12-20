// @ts-check
import { join } from "path";
import { readFileSync } from "fs";
import express from "express";
import serveStatic from "serve-static";

import shopify from "./shopify.js";
import productCreator from "./product-creator.js";
import PrivacyWebhookHandlers from "./privacy.js";
import { setupMetaobjects } from "./metaobject-setup.js";
import axios from "axios";

const PORT = parseInt(
  process.env.BACKEND_PORT || process.env.PORT || "3000",
  10
);

const STATIC_PATH =
  process.env.NODE_ENV === "production"
    ? `${process.cwd()}/frontend/dist`
    : `${process.cwd()}/frontend/`;

const app = express();

// Set up Shopify authentication and webhook handling
app.get(shopify.config.auth.path, shopify.auth.begin());
app.get(
  shopify.config.auth.callbackPath,
  shopify.auth.callback(),
  shopify.redirectToShopifyOrAppRoot()
);
app.post(
  shopify.config.webhooks.path,
  shopify.processWebhooks({ webhookHandlers: PrivacyWebhookHandlers })
);

// If you are adding routes outside of the /api path, remember to
// also add a proxy rule for them in web/frontend/vite.config.js

app.use("/api/*", shopify.validateAuthenticatedSession());

app.use(express.json());

app.get("/api/products/count", async (_req, res) => {
  const client = new shopify.api.clients.Graphql({
    session: res.locals.shopify.session,
  });

  const countData = await client.request(`
    query shopifyProductCount {
      productsCount {
        count
      }
    }
  `);

  res.status(200).send({ count: countData.data.productsCount.count });
});

app.post("/api/products", async (_req, res) => {
  let status = 200;
  let error = null;

  try {
    await productCreator(res.locals.shopify.session);
  } catch (e) {
    console.log(`Failed to process products/create: ${e.message}`);
    status = 500;
    error = e.message;
  }
  res.status(status).send({ success: status === 200, error });
});

app.post("/api/setup-metaobjects", async (_req, res) => {
  try {
    const result = await setupMetaobjects(res.locals.shopify.session);
    res.status(200).send(result);
  } catch (error) {
    console.error("Failed to setup metaobjects:", error);
    res.status(500).send(error.message);
  }
});

// Add these routes with your existing API routes

app.get("/api/tax-rates", async (_req, res) => {
  const client = new shopify.api.clients.Graphql({
    session: res.locals.shopify.session,
  });

  const response = await client.request(`
    query GetTaxRates {
      metaobjects(type: "market_tax_rate", first: 100) {
        edges {
          node {
            id
            fields {
              key
              value
            }
          }
        }
      }
    }
  `);

  const taxRates = response.data.metaobjects.edges.map((edge) => {
    const fields = edge.node.fields;
    return {
      id: edge.node.id,
      countryCode: fields.find((f) => f.key === "country_code").value,
      taxRate: fields.find((f) => f.key === "tax_rate").value,
    };
  });

  res.status(200).json(taxRates);
});

app.post("/api/tax-rates", async (req, res) => {
  const { countryCode, taxRate } = req.body;
  const client = new shopify.api.clients.Graphql({
    session: res.locals.shopify.session,
  });

  try {
    const response = await client.query({
      data: {
        query: `
          mutation createTaxRate($input: MetaobjectCreateInput!) {
            metaobjectCreate(metaobject: $input) {
              metaobject {
                id
                fields {
                  key
                  value
                }
              }
            }
          }
        `,
        variables: {
          input: {
            type: "market_tax_rate",
            fields: [
              { key: "country_code", value: countryCode },
              { key: "tax_rate", value: taxRate.toString() },
            ],
          },
        },
      },
    });

    res.status(200).json("success!");
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/tax-rates/:id", async (req, res) => {
  const { countryCode, taxRate } = req.body;
  const client = new shopify.api.clients.Graphql({
    session: res.locals.shopify.session,
  });

  try {
    const response = await client.request(
      `
      mutation updateTaxRate($id: ID!, $countryCode: String!, $taxRate: String!) {
        metaobjectUpdate(
          id: $id,
          metaobject: {
            fields: [
              {key: "country_code", value: $countryCode}
              {key: "tax_rate", value: $taxRate}
            ]
          }
        ) {
          metaobject {
            id
            fields {
              key
              value
            }
          }
        }
      }
    `,
      {
        variables: {
          id: decodeURIComponent(req.params.id),
          countryCode: countryCode,
          taxRate: taxRate.toString(),
        },
      }
    );

    res.status(200).json(response.data.metaobjectUpdate.metaobject);
  } catch (error) {
    console.log("Update error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/tax-rates/:id", async (req, res) => {
  const { id } = req.params;
  const client = new shopify.api.clients.Graphql({
    session: res.locals.shopify.session,
  });

  try {
    await client.query({
      data: {
        query: `
          mutation deleteTaxRate($id: ID!) {
            metaobjectDelete(id: $id) {
              deletedId
            }
          }
        `,
        variables: { id },
      },
    });

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add this after your existing tax rates endpoints
app.post("/api/sync-tax-rates", async (_req, res) => {
  const client = new shopify.api.clients.Graphql({
    session: res.locals.shopify.session,
  });

  try {
    // Get existing tax rates from metaobjects
    const response = await client.request(`
    query GetTaxRates {
      metaobjects(type: "market_tax_rate", first: 100) {
        edges {
          node {
            fields {
              key
              value
            }
          }
        }
      }
    }
  `);

    // Transform tax rates for the function
    const taxRates = {};
    response.data.metaobjects.edges.forEach((edge) => {
      const fields = edge.node.fields;
      const countryCode = fields.find((f) => f.key === "country_code").value;
      const rate = fields.find((f) => f.key === "tax_rate").value;
      taxRates[countryCode] = parseFloat(rate);
    });

    // Register tax rates with the function
    const functionResponse = await client.query({
      data: {
        query: `
          mutation CreateTaxCalculation($rates: JSON!) {
            functionTaxCalculationCreate(
              function: "tax-calculator"
              configuration: {
                taxRates: $rates
              }
            ) {
              functionTaxCalculation {
                id
              }
            }
          }
        `,
        variables: {
          rates: taxRates,
        },
      },
    });

    res.status(200).json({
      success: true,
      taxRates,
      functionResponse,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.post(
  "/api/validate-vat",
  shopify.validateAuthenticatedSession(),
  async (req, res) => {
    const { countryCode, vatNumber } = req.body;

    try {
      const response = await axios.post(
        "https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number",
        {
          countryCode,
          vatNumber,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      res.status(200).json({
        success: response.data.valid,
        message: response.data.valid
          ? "VAT number is valid"
          : "VAT number is invalid",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "VAT validation service error",
      });
    }
  }
);

app.get("/api/vat-settings", async (_req, res) => {
  const client = new shopify.api.clients.Graphql({
    session: res.locals.shopify.session,
  });

  try {
    const response = await client.request(`
      query GetVATSettings {
        metaobjects(type: "vat_settings", first: 1) {
          edges {
            node {
              fields {
                key
                value
              }
            }
          }
        }
      }
    `);

    const settings = response.data.metaobjects.edges[0]?.node.fields || [];
    res.status(200).json({
      enabled: settings.find((f) => f.key === "enabled")?.value === "true",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/vat-settings", async (req, res) => {
  const { enabled } = req.body;
  const client = new shopify.api.clients.Graphql({
    session: res.locals.shopify.session,
  });

  try {
    await client.request(`
      mutation UpdateVATSettings {
        metaobjectCreate(
          metaobject: {
            type: "vat_settings"
            fields: [
              { key: "enabled", value: "${enabled}" }
            ]
          }
        ) {
          metaobject {
            id
          }
        }
      }
    `);

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use(shopify.cspHeaders());
app.use(serveStatic(STATIC_PATH, { index: false }));

app.use("/*", shopify.ensureInstalledOnShop(), async (_req, res, _next) => {
  return res
    .status(200)
    .set("Content-Type", "text/html")
    .send(
      readFileSync(join(STATIC_PATH, "index.html"))
        .toString()
        .replace("%VITE_SHOPIFY_API_KEY%", process.env.SHOPIFY_API_KEY || "")
    );
});

app.listen(PORT);
