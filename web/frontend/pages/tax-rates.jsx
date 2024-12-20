import { useState } from "react";
import {
  Page,
  Layout,
  AlphaCard,
  DataTable,
  Button,
  ButtonGroup,
  Modal,
  Form,
  FormLayout,
  TextField,
  Select,
} from "@shopify/polaris";
import { useQuery, useMutation } from "react-query";
import countries from "../data/countries";

export default function TaxRates() {
  const [modalActive, setModalActive] = useState(false);
  const [editingRate, setEditingRate] = useState(null);
  const [formData, setFormData] = useState({
    countryCode: "",
    taxRate: "",
  });

  const { data: taxRates, refetch } = useQuery("taxRates", () =>
    fetch("/api/tax-rates").then((res) => res.json())
  );

  const addTaxRate = useMutation(
    (newRate) =>
      fetch("/api/tax-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRate),
      }),
    {
      onSuccess: () => {
        refetch();
        setModalActive(false);
        setEditingRate(null);
      },
    }
  );

  const deleteTaxRate = useMutation(
    (id) =>
      fetch(`/api/tax-rates/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    {
      onSuccess: () => refetch(),
    }
  );

  const updateTaxRate = useMutation(
    (rate) =>
      fetch(`/api/tax-rates/${encodeURIComponent(rate.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryCode: rate.countryCode,
          taxRate: rate.taxRate,
        }),
      }),
    {
      onSuccess: () => {
        refetch();
        setModalActive(false);
        setEditingRate(null);
      },
    }
  );

  const handleEdit = (rate) => {
    setEditingRate(rate);
    setFormData({
      countryCode: rate.countryCode,
      taxRate: rate.taxRate,
    });
    setModalActive(true);
  };

  const rows =
    taxRates?.map((rate) => [
      rate.countryCode,
      countries[rate.countryCode],
      `${rate.taxRate}%`,
      <ButtonGroup>
        <Button
          onClick={() => {
            setEditingRate(rate);
            setFormData({
              countryCode: rate.countryCode,
              taxRate: rate.taxRate,
            });
            setModalActive(true);
          }}
        >
          Edit
        </Button>
        <Button destructive onClick={() => deleteTaxRate.mutate(rate.id)}>
          Delete
        </Button>
      </ButtonGroup>,
    ]) || [];

  const countryOptions = Object.entries(countries).map(([code, name]) => ({
    label: name,
    value: code,
  }));

  const handleOpenModal = () => {
    setEditingRate(null);
    setFormData({
      countryCode: countryOptions[0].value,
      taxRate: "",
    });
    setModalActive(true);
  };

  return (
    <Page
      title="Tax Rates"
      primaryAction={{
        content: "Add Tax Rate",
        onAction: handleOpenModal,
      }}
    >
      <Layout>
        <Layout.Section>
          <AlphaCard>
            <DataTable
              columnContentTypes={["text", "text", "numeric", "text"]}
              headings={["Country Code", "Country Name", "Tax Rate", "Actions"]}
              rows={rows}
            />
          </AlphaCard>
        </Layout.Section>
      </Layout>

      <Modal
        open={modalActive}
        onClose={() => {
          setModalActive(false);
          setEditingRate(null);
        }}
        title={editingRate ? "Edit Tax Rate" : "Add Tax Rate"}
        primaryAction={{
          content: editingRate ? "Update" : "Add",
          onAction: () =>
            editingRate
              ? updateTaxRate.mutate({
                  id: editingRate.id,
                  countryCode: formData.countryCode,
                  taxRate: formData.taxRate,
                })
              : addTaxRate.mutate(formData),
          loading: addTaxRate.isLoading || updateTaxRate.isLoading,
        }}
      >
        <Modal.Section>
          <Form>
            <FormLayout>
              <Select
                label="Country"
                options={countryOptions}
                onChange={(value) =>
                  setFormData({ ...formData, countryCode: value })
                }
                value={formData.countryCode}
              />
              <TextField
                label="Tax Rate (%)"
                type="number"
                value={formData.taxRate}
                onChange={(value) =>
                  setFormData({ ...formData, taxRate: value })
                }
              />
            </FormLayout>
          </Form>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
