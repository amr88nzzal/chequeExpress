/**
 * English resources — the reference bundle.
 *
 * `typeof en` is used to type every other locale (`ar.ts`), so `tsc` fails the
 * build when a key is missing or misspelled in either language.
 * Keys are hierarchical: `issued.status.printed`, `print.confirm.errors.mismatch`.
 */
export const en = {
  app: {
    title: 'Cheque management',
    description: 'Multi-company cheque operations, printing and follow-up',
    skipToContent: 'Skip to content',
  },
  language: {
    label: 'Language',
    ar: 'العربية',
    en: 'English',
  },
  company: {
    label: 'Company',
    allCompanies: 'All companies',
    scopeNote: 'Data is limited to the selected company and to your permission scope',
  },
  nav: {
    main: 'Operations',
    administration: 'Administration',
    issued: 'Issued cheques',
    createDraft: 'New draft cheque',
    print: 'Print cheque',
    received: 'Received cheques',
    reports: 'Reports',
    settings: 'Settings',
  },
  common: {
    loading: 'Loading…',
    error: 'The data could not be loaded',
    retry: 'Try again',
    apply: 'Apply',
    reset: 'Reset',
    cancel: 'Cancel',
    save: 'Save',
    all: 'All',
    any: 'Any',
    optional: 'Optional',
    required: 'Required',
    unknown: 'Unknown',
    next: 'Next',
    previous: 'Previous',
    loadedOfTotal: '{{loaded}} of {{total}}',
    readOnly: 'Read only',
  },
  issued: {
    list: {
      title: 'Issued cheques',
      subtitle: 'Filter by status, due date, bank account or payee',
      loading: 'Loading cheques…',
      empty: 'No cheque matches the current filters',
      error: 'The cheque list could not be loaded',
      loadMore: 'Load more',
      pagingNote: 'Paging is cursor based; the cursor comes from the server response',
      filters: {
        title: 'Filters',
        status: 'Status',
        dueDateFrom: 'Due date from',
        dueDateTo: 'Due date to',
        account: 'Bank account',
        party: 'Payee',
      },
      columns: {
        number: 'Cheque number',
        dueDate: 'Due date',
        amount: 'Amount',
        party: 'Payee',
        account: 'Bank account',
        status: 'Status',
        actions: 'Actions',
      },
      actions: {
        print: 'Print',
        open: 'Open',
      },
    },
    status: {
      draft: 'Draft',
      pending_approval: 'Pending approval',
      approved: 'Approved',
      printing: 'Printing',
      printed: 'Printed',
      delivered: 'Delivered',
      cashed: 'Cashed',
      cancelled: 'Cancelled',
      damaged: 'Damaged',
      lost: 'Lost',
      stopped: 'Stopped',
    },
    partyType: {
      company: 'Company',
      individual: 'Individual',
      government: 'Government entity',
    },
  },
  draft: {
    title: 'New draft cheque',
    subtitle: 'The cheque number is reserved when printing, never when drafting',
    success: 'Draft saved',
    form: {
      title: 'Cheque details',
      fields: {
        company: 'Company',
        account: 'Bank account',
        party: 'Payee',
        amount: 'Amount',
        currency: 'Currency',
        issueDate: 'Issue date',
        dueDate: 'Due date',
        description: 'Description',
      },
      placeholders: {
        amount: '0.000',
        description: 'Optional note kept with the draft',
      },
      hints: {
        amount: 'A decimal string. {{currency}} accepts at most {{digits}} fraction digits.',
      },
      actions: {
        submit: 'Save draft',
        cancel: 'Cancel',
      },
      errors: {
        required: 'This field is required',
        amountRequired: 'Enter the amount',
        amountFormat: 'Enter the amount as a decimal string: digits with one decimal point only',
        amountFractionDigits: '{{currency}} accepts at most {{digits}} fraction digits',
        amountPositive: 'The amount must be greater than zero',
        dueDateBeforeIssue: 'The due date cannot be before the issue date',
      },
    },
  },
  print: {
    title: 'Print cheque',
    subtitle: 'Check the preview, the printer and the expected cheque number before sending',
    fields: {
      cheque: 'Cheque',
      number: 'Cheque number',
      printer: 'Printer',
      lastExpectedNumber: 'Last expected cheque number',
      preview: 'Preview',
      payee: 'Pay to',
      amount: 'Amount',
      amountInWords: 'Amount in words',
      account: 'Bank account',
      dueDate: 'Due date',
    },
    previewNote: 'The exact-size preview is produced by the printing service',
    wordsPending: 'Produced by the server when the cheque is printed',
    confirm: {
      title: 'Confirm the loaded cheque',
      instruction:
        'Type the last {{digits}} digits of the cheque number that is actually loaded in the printer.',
      field: 'Loaded cheque last {{digits}} digits',
      actions: {
        confirm: 'Confirm and send to the printer',
        cancel: 'Cancel',
      },
      errors: {
        required: 'Enter the last digits of the loaded cheque',
        length: 'Enter exactly {{digits}} digits',
        mismatch: 'The digits do not match the expected cheque number',
      },
    },
    state: {
      idle: 'Ready to send',
      sending: 'Sending to the printer…',
      sent: 'Sent to the printer',
      failed: 'The printer rejected the job',
    },
    backToList: 'Back to issued cheques',
  },
  permissions: {
    cheques: {
      issued: {
        view: 'View issued cheques',
        create: 'Create a draft cheque',
        print: 'Print a cheque',
        deliver: 'Mark a cheque as delivered',
      },
      received: {
        view: 'View received cheques',
      },
      reports: {
        view: 'View reports',
      },
      settings: {
        manage: 'Manage tenant settings',
      },
    },
  },
  forbidden: {
    title: '403 — Not allowed',
    description: 'Your account does not hold the permission this screen requires.',
    requiredPermission: 'Required permission: {{permission}}',
    scopeNote: 'The permission may be granted on a company or bank-account scope you cannot reach.',
    back: 'Back to issued cheques',
  },
  notFound: {
    title: '404 — Not found',
    description: 'This screen does not exist, or the record is outside your scope.',
    back: 'Back to issued cheques',
  },
  error: {
    title: 'Something went wrong',
    description: 'An unexpected error stopped this screen from rendering.',
    retry: 'Reload the screen',
  },
};
