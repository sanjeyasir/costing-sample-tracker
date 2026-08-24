import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#6366f1", // Indigo
      light: "#818cf8",
      dark: "#4f46e5",
      contrastText: "#ffffff"
    },
    secondary: {
      main: "#10b981", // Emerald Green
      light: "#34d399",
      dark: "#059669",
      contrastText: "#ffffff"
    },
    success: {
      main: "#10b981",
      light: "#34d399",
      dark: "#059669",
      contrastText: "#ffffff"
    },
    error: {
      main: "#ef4444",
      light: "#f87171",
      dark: "#dc2626",
      contrastText: "#ffffff"
    },
    warning: {
      main: "#f59e0b",
      light: "#fbbf24",
      dark: "#d97706",
      contrastText: "#080c14"
    },
    info: {
      main: "#3b82f6",
      light: "#60a5fa",
      dark: "#2563eb",
      contrastText: "#ffffff"
    },
    background: {
      default: "#080c14", // Deep space blue
      paper: "#0f172a"    // Dark slate
    },
    text: {
      primary: "#f8fafc",
      secondary: "#94a3b8",
      disabled: "#64748b"
    },
    divider: "rgba(255, 255, 255, 0.08)"
  },
  typography: {
    fontFamily: '"Outfit", "Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontSize: "2.5rem", fontWeight: 800, letterSpacing: "-0.03em", color: "#f8fafc" },
    h2: { fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.025em", color: "#f8fafc" },
    h3: { fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.02em" },
    h4: { fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.015em" },
    h5: { fontSize: "1.25rem", fontWeight: 600 },
    h6: { fontSize: "1rem", fontWeight: 600 },
    subtitle1: { fontSize: "1rem", fontWeight: 500, lineHeight: 1.5 },
    subtitle2: { fontSize: "0.875rem", fontWeight: 600, lineHeight: 1.4 },
    body1: { fontSize: "0.95rem", lineHeight: 1.6, color: "#94a3b8" },
    body2: { fontSize: "0.85rem", lineHeight: 1.5, color: "#64748b" },
    button: { textTransform: "none", fontWeight: 600, letterSpacing: "0.01em" }
  },
  shape: {
    borderRadius: 12
  },
  shadows: [
    "none",
    "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    "0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)",
    "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)",
    "0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -4px rgba(0, 0, 0, 0.2)",
    "0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)",
    ...Array(20).fill("none")
  ],
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: "8px 18px",
          fontWeight: 600,
          boxShadow: "none",
          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          "&:hover": {
            boxShadow: "none",
            transform: "translateY(-1px)"
          },
          "&:active": {
            transform: "translateY(0)"
          }
        },
        containedPrimary: {
          background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
          color: "#ffffff",
          "&:hover": {
            background: "linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)"
          }
        },
        containedSecondary: {
          background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
          color: "#ffffff",
          "&:hover": {
            background: "linear-gradient(135deg, #059669 0%, #047857 100%)"
          }
        },
        outlined: {
          borderWidth: "1.5px",
          borderColor: "rgba(255, 255, 255, 0.12)",
          "&:hover": {
            borderWidth: "1.5px",
            borderColor: "rgba(255, 255, 255, 0.24)",
            backgroundColor: "rgba(255, 255, 255, 0.02)"
          }
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
          border: "1px solid rgba(255, 255, 255, 0.06)",
          backgroundColor: "#0f172a",
          backgroundImage: "none"
        }
      }
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 700,
          backgroundColor: "rgba(255, 255, 255, 0.02)",
          color: "#94a3b8",
          borderBottom: "2px solid rgba(255, 255, 255, 0.08)",
          fontSize: "0.8rem",
          textTransform: "uppercase",
          letterSpacing: "0.05em"
        },
        root: {
          padding: "16px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
          fontSize: "0.9rem",
          color: "#cbd5e1"
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          borderRadius: 9999,
          transition: "all 0.15s ease-in-out"
        },
        sizeSmall: {
          fontSize: "0.75rem",
          height: "24px"
        }
      }
    },
    MuiTextField: {
      defaultProps: {
        size: "medium",
        variant: "outlined"
      }
    },
    MuiSelect: {
      defaultProps: {
        size: "medium",
        variant: "outlined"
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          backgroundColor: "rgba(15, 23, 42, 0.4)",
          transition: "all 0.15s ease-in-out",
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "rgba(255, 255, 255, 0.12)"
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "rgba(255, 255, 255, 0.24)"
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#6366f1",
            borderWidth: "2px"
          }
        }
      }
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: "#0f172a",
          backgroundImage: "none",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 16
        }
      }
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: "1px solid rgba(255, 255, 255, 0.08)",
          backgroundColor: "#0b0f19"
        }
      }
    }
  }
});

export default theme;
