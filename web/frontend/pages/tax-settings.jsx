import { Page, Layout, AlphaCard, Button } from "@shopify/polaris";
import { useNavigate } from "react-router-dom";
import { useQuery } from "react-query";

export default function TaxSettings() {
  const navigate = useNavigate();

  const { isLoading, error, data } = useQuery("setupMetaobjects", () =>
    fetch("/api/setup-metaobjects", { method: "POST" }).then((res) =>
      res.json()
    )
  );

  return (
    <Page title="Tax Settings">
      <Layout>
        <Layout.Section>
          <AlphaCard sectioned>
            <Button
              primary
              loading={isLoading}
              onClick={() => navigate("/tax-rates")}
            >
              Configure Tax Rates
            </Button>
            {error && <div>Error: {error.message}</div>}
            {data && <div>Setup completed successfully!</div>}
          </AlphaCard>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
