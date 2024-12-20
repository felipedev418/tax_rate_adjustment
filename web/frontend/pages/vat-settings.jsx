import { useState } from "react";
import {
  Page,
  Layout,
  AlphaCard,
  FormLayout,
  TextField,
  Banner,
  Button,
  Box,
  Text,
  ButtonGroup,
} from "@shopify/polaris";
import { useQuery, useMutation } from "react-query";
import { validateVAT } from "../utils/vatValidator";

export default function VATSettings() {
  const [vatEnabled, setVatEnabled] = useState(true);
  const [testVAT, setTestVAT] = useState("");
  const [validationResult, setValidationResult] = useState(null);

  const { data: settings } = useQuery("vatSettings", () =>
    fetch("/api/vat-settings").then((res) => res.json())
  );

  const updateSettings = useMutation(
    (newSettings) =>
      fetch("/api/vat-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSettings),
      }),
    {
      onSuccess: () => {
        setValidationResult({
          success: true,
          message: "Settings updated successfully",
        });
      },
    }
  );

  const handleTestVAT = async () => {
    try {
      const countryCode = testVAT.substring(0, 2);
      //   const number = testVAT.substring(2);
      const result = await validateVAT(countryCode, testVAT);
      setValidationResult(result);
    } catch (error) {
      setValidationResult({
        success: false,
        message: error.message,
      });
    }
  };

  return (
    <Page title="VAT Settings">
      <Layout>
        <Layout.Section>
          <AlphaCard sectioned>
            <Box paddingBlockEnd="4">
              <Text variant="headingMd" as="h2">
                VAT Validation
              </Text>
            </Box>
            <Box paddingBlockEnd="4">
              <Text as="p" variant="bodyMd">
                VAT Validation is{" "}
                <Text as="span" fontWeight="bold">
                  {vatEnabled ? "enabled" : "disabled"}
                </Text>
              </Text>
            </Box>
            <ButtonGroup>
              <Button
                onClick={() => {
                  setVatEnabled(!vatEnabled);
                  updateSettings.mutate({ enabled: !vatEnabled });
                }}
              >
                {vatEnabled ? "Disable" : "Enable"}
              </Button>
            </ButtonGroup>
          </AlphaCard>
        </Layout.Section>

        <Layout.Section>
          <AlphaCard sectioned title="Test VAT Number">
            <FormLayout>
              <TextField
                label="VAT Number (including country code)"
                value={testVAT}
                onChange={setTestVAT}
                placeholder="e.g., ATU12345678"
              />
              <Button onClick={handleTestVAT}>Validate VAT</Button>
              {validationResult && (
                <Banner
                  status={validationResult.success ? "success" : "critical"}
                >
                  {validationResult.message}
                </Banner>
              )}
            </FormLayout>
          </AlphaCard>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
