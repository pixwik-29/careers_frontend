// API Configuration
// Backend URL is read from environment variable REACT_APP_BACKEND_URL
// If not set, it defaults to the production URL
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "https://careersbackend.pixwik.com";
const API = `${BACKEND_URL}/api`;

// Helper function to add ngrok bypass header to axios config
function getAxiosConfig(config = {}) {
  return {
    ...config,
    headers: {
      'ngrok-skip-browser-warning': 'true',
      ...(config.headers || {})
    }
  };
}

// Helper function to extract error messages from various error formats
// Handles FastAPI/Pydantic validation errors, axios errors, and plain strings
function extractErrorMessage(error, fallback = "An error occurred") {
  if (!error) return fallback;
  
  // If it's already a string, return it
  if (typeof error === "string") return error;
  
  // If it's an object with a detail property (FastAPI error response)
  if (error?.response?.data?.detail) {
    const detail = error.response.data.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      // Handle array of validation errors (Pydantic validation errors)
      return detail.map((err) => {
        if (typeof err === "string") return err;
        if (err?.msg) return err.msg;
        if (err?.type && err?.loc) {
          // Format: "Field name: error message"
          const field = Array.isArray(err.loc) ? err.loc.slice(-1)[0] : err.loc;
          return `${field}: ${err.msg || err.type}`;
        }
        return JSON.stringify(err);
      }).join(", ");
    }
    if (typeof detail === "object") {
      // Handle validation error object
      if (detail.msg) return detail.msg;
      if (detail.message) return detail.message;
      return JSON.stringify(detail);
    }
  }
  
  // If it's an object with a detail property directly (not nested in response)
  if (error?.detail) {
    const detail = error.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail.map((err) => {
        if (typeof err === "string") return err;
        if (err?.msg) return err.msg;
        if (err?.type && err?.loc) {
          const field = Array.isArray(err.loc) ? err.loc.slice(-1)[0] : err.loc;
          return `${field}: ${err.msg || err.type}`;
        }
        return JSON.stringify(err);
      }).join(", ");
    }
  }
  
  // If it's an object with a message property
  if (error?.message) return error.message;
  
  // If it's a validation error object with type, loc, msg
  if (error?.type && error?.loc && error?.msg) {
    const field = Array.isArray(error.loc) ? error.loc.slice(-1)[0] : error.loc;
    return `${field}: ${error.msg}`;
  }
  
  // Last resort: stringify the error
  try {
    return JSON.stringify(error);
  } catch {
    return fallback;
  }
}

export { BACKEND_URL, API, getAxiosConfig, extractErrorMessage };

