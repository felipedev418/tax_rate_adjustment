import shopify from "./shopify.js";

export async function setupMetaobjects(session) {
  const client = new shopify.api.clients.Graphql({ session });

  // Create Market Tax Rate definition
  const marketTaxDefinition = await client.request(`
    mutation CreateMarketTaxMetaobjectDefinition {
      metaobjectDefinitionCreate(
        definition: {
          type: "market_tax_rate",
          name: "Market Tax Rate",
          fieldDefinitions: [
            { key: "country_code", name: "Country Code", type: "single_line_text_field", required: true },
            { key: "tax_rate", name: "Tax Rate", type: "number_decimal", required: true }
          ]
        }
      ) {
        metaobjectDefinition {
          id
        }
        userErrors {
          field
          message
        }
      }
    }
  `);

  // Create Product Tax Rate definition
  const productTaxDefinition = await client.request(`
    mutation CreateProductTaxMetaobjectDefinition {
      metaobjectDefinitionCreate(
        definition: {
          type: "product_tax_rate",
          name: "Product Tax Rate",
          fieldDefinitions: [
            { key: "product_id", name: "Product ID", type: "single_line_text_field", required: true },
            { key: "country_code", name: "Country Code", type: "single_line_text_field", required: true },
            { key: "tax_rate", name: "Tax Rate", type: "number_decimal", required: true }
          ]
        }
      ) {
        metaobjectDefinition {
          id
        }
        userErrors {
          field
          message
        }
      }
    }
  `);

  return {
    marketTaxDefinition,
    productTaxDefinition,
  };
}
