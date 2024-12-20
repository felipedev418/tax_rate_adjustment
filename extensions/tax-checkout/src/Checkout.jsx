import {
  reactExtension,
  Banner,
  BlockStack,
  Grid,
  TextField,
  Select,
  useApi,
  useTranslate,
  useCartLines,
  useApplyAttributeChange,
  useApplyCartLinesChange,
  useBuyerJourney,
  Text,
} from "@shopify/ui-extensions-react/checkout";
import { useState } from "react";
import countries from "./countries";

export default reactExtension("purchase.checkout.block.render", () => (
  <Extension />
));

function Extension() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    company: "",
    address: "",
    postalCode: "",
    city: "",
    phone: "",
    vatId: "",
    countryCode: "",
  });

  const [validationMessage, setValidationMessage] = useState("");
  const translate = useTranslate();
  const { extension, query } = useApi();
  const applyAttributeChange = useApplyAttributeChange();
  const cartLines = useCartLines();
  const applyCartLinesChange = useApplyCartLinesChange();
  const [taxRate, setTaxRate] = useState(0);

  const getTaxRateForCountry = async (countryCode) => {
    const response = await query(`
      query GetTaxRate {
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
    console.log(response, "response");
    const taxRates = response.data.metaobjects.edges.filter((edge) => {
      const fields = edge.node.fields;
      const countryCodeField = fields.filter(
        (field) => field.key === "country_code" && field.value === countryCode
      );
      return countryCodeField.length > 0;
    });

    if (taxRates.length > 0) {
      const taxRateField = taxRates[0].node.fields.filter(
        (field) => field.key === "tax_rate"
      )[0];
      return parseFloat(taxRateField.value);
    }

    return 0;
  };

  const handleCountryChange = async (value) => {
    setFormData((prev) => ({ ...prev, countryCode: value }));
    const taxRate = (await getTaxRateForCountry(value)) || 5;
    setTaxRate(taxRate);

    console.log("Cart Lines:", cartLines);

    // Calculate new prices with tax and prepare cart line updates
    const updates = cartLines.map((line) => {
      const originalPrice = parseFloat(line.cost.totalAmount.amount);
      const priceWithTax = (originalPrice * (1 + taxRate / 100)).toFixed(2);

      return {
        type: "updateCartLine",
        id: line.id,
        attributes: [
          { key: "taxRate", value: taxRate.toString() },
          { key: "priceWithTax", value: priceWithTax },
        ],
      };
    });

    // Apply the updates to cart lines
    for (const update of updates) {
      await applyCartLinesChange(update);
    }
  };

  const handleVatChange = async (value) => {
    setFormData((prev) => ({ ...prev, vatId: value }));
    if (value) {
      try {
        const response = await query(
          `
          mutation validateVat($input: VatValidationInput!) {
            vatValidate(input: $input) {
              valid
              message
            }
          }
        `,
          {
            variables: {
              input: {
                vatNumber: value,
                countryCode: formData.countryCode,
              },
            },
          }
        );

        const result = response.data.vatValidate;
        if (result.valid) {
          await applyAttributeChange({
            key: "vatExempt",
            type: "updateAttribute",
            value: "true",
          });
          setValidationMessage("VAT number validated successfully");
        } else {
          setValidationMessage(result.message || "Invalid VAT number");
        }
      } catch (error) {
        setValidationMessage("VAT validation failed");
      }
    }
  };

  return (
    <BlockStack spacing="loose">
      <Select
        label="Country (required)"
        value={formData.countryCode}
        onChange={handleCountryChange}
        options={Object.entries(countries).map(([code, name]) => ({
          label: name,
          value: code,
        }))}
        required
      />

      <TextField
        label="VAT-ID (optional)"
        value={formData.vatId}
        onChange={handleVatChange}
        helpText="Enter VAT ID for business customers"
      />

      {validationMessage && (
        <Banner
          status={
            validationMessage.includes("success") ? "success" : "critical"
          }
        >
          {validationMessage}
        </Banner>
      )}

      {/* Display Totals with Dynamic Tax */}
      <Grid columns={["1fr", "auto"]} spacing="tight">
        {/* Original Total */}
        <Text size="medium" appearance="subdued">
          Original Total:
        </Text>
        <Text size="medium" fontWeight="bold">
          {cartLines
            .reduce((total, line) => {
              return total + parseFloat(line.cost.totalAmount.amount);
            }, 0)
            .toFixed(2)}{" "}
          {cartLines[0]?.cost.totalAmount.currencyCode || "USD"}
        </Text>

        {/* Total with Tax */}
        <Text size="medium" appearance="subdued">
          Total with Tax ({taxRate}%):
        </Text>
        <Text size="medium" fontWeight="bold">
          {cartLines
            .reduce((total, line) => {
              const lineAmount = parseFloat(line.cost.totalAmount.amount);
              return total + lineAmount * (1 + taxRate / 100);
            }, 0)
            .toFixed(2)}{" "}
          {cartLines[0]?.cost.totalAmount.currencyCode || "USD"}
        </Text>
      </Grid>
    </BlockStack>
  );
}
