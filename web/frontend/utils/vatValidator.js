import axios from "axios";

export async function validateVAT(countryCode, vatNumber) {
  try {
    const response = await axios.post(
      "https://api.allorigins.win/raw?url=https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number",
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

    return {
      success: response.data.valid,
      message: response.data.valid
        ? "VAT number is valid"
        : "VAT number is invalid",
    };
  } catch (error) {
    return {
      success: false,
      message: "VAT validation service error: " + error.message,
    };
  }
}
