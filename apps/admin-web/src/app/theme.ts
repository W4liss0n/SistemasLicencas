import { alpha, createTheme } from '@mui/material/styles';

export const appTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#1f5d98' },
    success: { main: '#2d6a3f' },
    warning: { main: '#b86c17' },
    error: { main: '#b42318' },
    info: { main: '#1d6d82' },
    background: {
      default: '#e6ebf2',
      paper: '#f3f6f9'
    },
    text: {
      primary: '#14202c',
      secondary: '#34465a'
    },
    divider: 'rgba(20, 32, 44, 0.09)'
  },
  shape: {
    borderRadius: 14
  },
  typography: {
    fontFamily: 'var(--controlroom-sans)',
    h4: {
      fontWeight: 700,
      fontSize: '1.95rem',
      lineHeight: 1.08,
      letterSpacing: '-0.02em'
    },
    h5: {
      fontWeight: 700,
      letterSpacing: '-0.02em'
    },
    h6: {
      fontWeight: 700,
      letterSpacing: '-0.01em'
    },
    subtitle1: {
      fontWeight: 600
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
      letterSpacing: '0.01em'
    },
    body2: {
      color: 'var(--controlroom-ink-secondary)'
    },
    overline: {
      letterSpacing: '0.1em',
      fontWeight: 600,
      color: 'var(--controlroom-ink-muted)'
    }
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: 'var(--controlroom-canvas)'
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: 'var(--controlroom-surface)',
          border: '1px solid var(--controlroom-border-soft)',
          boxShadow: 'none'
        }
      }
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true
      },
      styleOverrides: {
        root: {
          minHeight: 36,
          borderRadius: '10px'
        },
        contained: {
          color: '#f5f8fc',
          backgroundColor: 'var(--controlroom-accent)',
          border: '1px solid transparent',
          '&:hover': {
            backgroundColor: 'var(--controlroom-accent-strong)'
          }
        },
        outlined: {
          borderColor: 'var(--controlroom-border-strong)',
          color: 'var(--controlroom-ink-primary)',
          backgroundColor: 'var(--controlroom-surface-elevated)',
          '&:hover': {
            borderColor: 'var(--controlroom-border-emphasis)',
            backgroundColor: alpha('#1f5d98', 0.06)
          }
        }
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: 'var(--controlroom-control)',
          borderRadius: '10px',
          transition: 'border-color 120ms ease, background-color 120ms ease, box-shadow 120ms ease',
          '&:hover': {
            backgroundColor: 'var(--controlroom-control-hover)',
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: 'var(--controlroom-border-strong)'
            }
          },
          '&.Mui-focused': {
            backgroundColor: 'var(--controlroom-control-hover)',
            boxShadow: `0 0 0 3px ${alpha('#1f5d98', 0.14)}`,
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: 'var(--controlroom-focus)'
            }
          }
        },
        notchedOutline: {
          borderColor: 'var(--controlroom-border-soft)'
        },
        input: {
          fontSize: '0.95rem'
        }
      }
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: 'var(--controlroom-ink-tertiary)',
          fontWeight: 500
        }
      }
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: {
          marginLeft: 4
        }
      }
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: '10px',
          border: '1px solid var(--controlroom-border-soft)'
        },
        standardInfo: {
          backgroundColor: alpha('#1d6d82', 0.1),
          color: '#164c5b'
        },
        standardSuccess: {
          backgroundColor: 'var(--controlroom-success-surface)',
          color: '#1f5f26'
        },
        standardWarning: {
          backgroundColor: 'var(--controlroom-warning-surface)',
          color: '#7e4a04'
        },
        standardError: {
          backgroundColor: 'var(--controlroom-danger-surface)',
          color: '#7f1d15'
        }
      }
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          border: '1px solid var(--controlroom-border-soft)',
          borderRadius: '12px',
          backgroundColor: 'var(--controlroom-surface-elevated)'
        }
      }
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: 'var(--controlroom-surface-strong)'
        }
      }
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:last-child td': {
            borderBottom: 0
          },
          '&:hover': {
            backgroundColor: alpha('#1f5d98', 0.06)
          }
        }
      }
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid var(--controlroom-border-soft)',
          paddingTop: 10,
          paddingBottom: 10
        },
        head: {
          fontWeight: 700,
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--controlroom-ink-tertiary)'
        }
      }
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: '10px',
          border: '1px solid transparent',
          '&.Mui-selected': {
            borderColor: 'var(--controlroom-border-emphasis)',
            backgroundColor: 'var(--controlroom-accent-surface)',
            '&:hover': {
              backgroundColor: alpha('#1f5d98', 0.14)
            }
          },
          '&:hover': {
            backgroundColor: alpha('#1f5d98', 0.06)
          }
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 600,
          border: '1px solid var(--controlroom-border-soft)',
          backgroundColor: 'var(--controlroom-surface-elevated)'
        }
      }
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: 'var(--controlroom-border-soft)'
        }
      }
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 14,
          backgroundColor: 'var(--controlroom-surface-elevated)'
        }
      }
    },
    MuiStepLabel: {
      styleOverrides: {
        label: {
          fontWeight: 600
        }
      }
    }
  }
});
