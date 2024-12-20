import {
  render,
  Banner,
  Button,
  Grid,
  TextField,
  Select,
  Text,
  useExtensionApi,
  useShippingAddress,
  useApplyShippingAddressChange,
  useCartLines,
} from "@shopify/checkout-ui-extensions-react";
import { useState, useEffect } from "react";
import { countries } from "./countries";

function Extension() {
  const { extension } = useExtensionApi();
  const shippingAddress = useShippingAddress();
  const applyShippingAddressChange = useApplyShippingAddressChange();
  const cartLines = useCartLines();

  const [address, setAddress] = useState({
    firstName: "",
    lastName: "",
    company: "",
    address1: "",
    postalCode: "",
    city: "",
    country: "",
    phone: "",
    vatId: "",
  });

  const [taxCalculation, setTaxCalculation] = useState({
    subtotal: 0,
    taxRate: 0,
    taxAmount: 0,
    total: 0,
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (shippingAddress) {
      setAddress((prev) => ({
        ...prev,
        ...shippingAddress,
      }));
    }
  }, [shippingAddress]);

  useEffect(() => {
    if (address.country && cartLines) {
      calculateTax();
    }
  }, [address.country, address.vatId, cartLines]);

  const calculateTax = async () => {
    try {
      let taxRate = 0;

      if (address.vatId) {
        const vatValidation = await validateVatId();
        if (vatValidation.success) {
          taxRate = 0;
        }
      }

      if (!address.vatId || !vatValidation?.success) {
        const response = await fetch(`/api/tax-rates/${address.country}`);
        const data = await response.json();
        taxRate = data.taxRate;
      }

      const subtotal = cartLines.reduce(
        (sum, line) => sum + line.cost.amount,
        0
      );
      const taxAmount = subtotal * (taxRate / 100);

      setTaxCalculation({
        subtotal,
        taxRate,
        taxAmount,
        total: subtotal + taxAmount,
      });
    } catch (error) {
      setErrors({ tax: "Failed to calculate tax" });
    }
  };

  const validateVatId = async () => {
    try {
      const response = await fetch("/api/validate-vat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryCode: address.country,
          vatNumber: address.vatId,
        }),
      });
      return await response.json();
    } catch (error) {
      return { success: false };
    }
  };

  const handleChange = (field, value) => {
    setAddress((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!address.country) newErrors.country = "Country is required";
    if (!address.address1) newErrors.address1 = "Address is required";
    if (!address.postalCode) newErrors.postalCode = "Postal code is required";
    if (!address.city) newErrors.city = "City is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      await applyShippingAddressChange({
        type: "updateShippingAddress",
        address: address,
      });
    } catch (error) {
      setErrors({ submit: error.message });
    }
  };

  return (
    <Grid>
      <Select
        label="Country"
        value={address.country}
        onChange={(value) => handleChange("country", value)}
        options={countries}
        required
        error={errors.country}
      />

      <TextField
        label="First Name"
        value={address.firstName}
        onChange={(value) => handleChange("firstName", value)}
      />

      <TextField
        label="Last Name"
        value={address.lastName}
        onChange={(value) => handleChange("lastName", value)}
      />

      <TextField
        label="Company"
        value={address.company}
        onChange={(value) => handleChange("company", value)}
      />

      <TextField
        label="Address"
        value={address.address1}
        onChange={(value) => handleChange("address1", value)}
        required
        error={errors.address1}
      />

      <TextField
        label="Postal Code"
        value={address.postalCode}
        onChange={(value) => handleChange("postalCode", value)}
        required
        error={errors.postalCode}
      />

      <TextField
        label="City"
        value={address.city}
        onChange={(value) => handleChange("city", value)}
        required
        error={errors.city}
      />

      <TextField
        label="Phone"
        value={address.phone}
        onChange={(value) => handleChange("phone", value)}
        type="tel"
      />

      <TextField
        label="VAT ID"
        value={address.vatId}
        onChange={(value) => handleChange("vatId", value)}
        helpText="Optional for business customers"
      />

      <Grid>
        <Text>Subtotal: ${taxCalculation.subtotal}</Text>
        <Text>Tax Rate: {taxCalculation.taxRate}%</Text>
        <Text>Tax Amount: ${taxCalculation.taxAmount}</Text>
        <Text>Total: ${taxCalculation.total}</Text>
      </Grid>

      {errors.tax && <Banner status="critical">{errors.tax}</Banner>}

      {errors.submit && <Banner status="critical">{errors.submit}</Banner>}

      <Button onPress={handleSubmit}>Update Address</Button>
    </Grid>
  );
}

render("Checkout::Dynamic::Render", () => <Extension />);
