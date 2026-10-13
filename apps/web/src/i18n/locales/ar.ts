import type { en } from './en';

/**
 * Arabic resources. The `typeof en` annotation is deliberate: a missing or
 * extra key in either language is a `tsc` error, so neither bundle can be
 * shipped incomplete.
 */
export const ar: typeof en = {
  app: {
    title: 'إدارة الشيكات',
    description: 'عمليات الشيكات لعدة شركات: الإصدار والطباعة والمتابعة',
    skipToContent: 'تخطَّ إلى المحتوى',
  },
  language: {
    label: 'اللغة',
    ar: 'العربية',
    en: 'English',
  },
  company: {
    label: 'الشركة',
    allCompanies: 'كل الشركات',
    scopeNote: 'البيانات محدودة بالشركة المختارة وبنطاق صلاحيتك',
  },
  nav: {
    main: 'العمليات',
    administration: 'الإدارة',
    issued: 'الشيكات الصادرة',
    createDraft: 'مسودة شيك جديدة',
    print: 'طباعة شيك',
    received: 'الشيكات الواردة',
    reports: 'التقارير',
    settings: 'الإعدادات',
  },
  common: {
    loading: 'جارٍ التحميل…',
    error: 'تعذّر تحميل البيانات',
    retry: 'أعد المحاولة',
    apply: 'تطبيق',
    reset: 'إعادة ضبط',
    cancel: 'إلغاء',
    save: 'حفظ',
    all: 'الكل',
    any: 'أي',
    optional: 'اختياري',
    required: 'مطلوب',
    unknown: 'غير معروف',
    next: 'التالي',
    previous: 'السابق',
    loadedOfTotal: '{{loaded}} من {{total}}',
    readOnly: 'للعرض فقط',
  },
  issued: {
    list: {
      title: 'الشيكات الصادرة',
      subtitle: 'صفِّ حسب الحالة أو تاريخ الاستحقاق أو الحساب البنكي أو المستفيد',
      loading: 'جارٍ تحميل الشيكات…',
      empty: 'لا يوجد شيك مطابق للمرشّحات الحالية',
      error: 'تعذّر تحميل قائمة الشيكات',
      loadMore: 'تحميل المزيد',
      pagingNote: 'الترقيم بمؤشر، والمؤشر يأتي من استجابة الخادم',
      filters: {
        title: 'المرشّحات',
        status: 'الحالة',
        dueDateFrom: 'تاريخ الاستحقاق من',
        dueDateTo: 'تاريخ الاستحقاق إلى',
        account: 'الحساب البنكي',
        party: 'المستفيد',
      },
      columns: {
        number: 'رقم الشيك',
        dueDate: 'تاريخ الاستحقاق',
        amount: 'المبلغ',
        party: 'المستفيد',
        account: 'الحساب البنكي',
        status: 'الحالة',
        actions: 'إجراءات',
      },
      actions: {
        print: 'طباعة',
        open: 'فتح',
      },
    },
    status: {
      draft: 'مسودة',
      pending_approval: 'بانتظار الاعتماد',
      approved: 'معتمد',
      printing: 'قيد الطباعة',
      printed: 'مطبوع',
      delivered: 'مُسلَّم',
      cashed: 'مصروف',
      cancelled: 'ملغى',
      damaged: 'تالف',
      lost: 'مفقود',
      stopped: 'موقوف',
    },
    partyType: {
      company: 'شركة',
      individual: 'فرد',
      government: 'جهة حكومية',
    },
  },
  draft: {
    title: 'مسودة شيك جديدة',
    subtitle: 'رقم الشيك يُحجز عند الطباعة لا عند إنشاء المسودة',
    success: 'حُفظت المسودة',
    form: {
      title: 'بيانات الشيك',
      fields: {
        company: 'الشركة',
        account: 'الحساب البنكي',
        party: 'المستفيد',
        amount: 'المبلغ',
        currency: 'العملة',
        issueDate: 'تاريخ الإصدار',
        dueDate: 'تاريخ الاستحقاق',
        description: 'الوصف',
      },
      placeholders: {
        amount: '0.000',
        description: 'ملاحظة اختيارية تُحفظ مع المسودة',
      },
      hints: {
        amount: 'نص عشري. {{currency}} يقبل {{digits}} خانات كسر على الأكثر.',
      },
      actions: {
        submit: 'حفظ المسودة',
        cancel: 'إلغاء',
      },
      errors: {
        required: 'هذا الحقل مطلوب',
        amountRequired: 'أدخل المبلغ',
        amountFormat: 'أدخل المبلغ نصاً عشرياً: أرقام وفاصلة عشرية واحدة فقط',
        amountFractionDigits: '{{currency}} يقبل {{digits}} خانات كسر على الأكثر',
        amountPositive: 'يجب أن يكون المبلغ أكبر من صفر',
        dueDateBeforeIssue: 'لا يجوز أن يسبق تاريخ الاستحقاق تاريخ الإصدار',
      },
    },
  },
  print: {
    title: 'طباعة شيك',
    subtitle: 'راجع المعاينة والطابعة وآخر رقم شيك متوقع قبل الإرسال',
    fields: {
      cheque: 'الشيك',
      number: 'رقم الشيك',
      printer: 'الطابعة',
      lastExpectedNumber: 'آخر رقم شيك متوقع',
      preview: 'المعاينة',
      payee: 'يُدفع إلى',
      amount: 'المبلغ',
      amountInWords: 'المبلغ بالأحرف',
      account: 'الحساب البنكي',
      dueDate: 'تاريخ الاستحقاق',
    },
    previewNote: 'تُنتَج المعاينة بالمقاس الفعلي في خدمة الطباعة',
    wordsPending: 'يُولَّد في الخادم عند طباعة الشيك',
    confirm: {
      title: 'تأكيد الشيك الموضوع في الطابعة',
      instruction: 'اكتب آخر {{digits}} أرقام من رقم الشيك الموضوع فعلاً في الطابعة.',
      field: 'آخر {{digits}} أرقام من الشيك الموضوع',
      actions: {
        confirm: 'تأكيد وإرسال إلى الطابعة',
        cancel: 'إلغاء',
      },
      errors: {
        required: 'أدخل آخر أرقام الشيك الموضوع في الطابعة',
        length: 'أدخل {{digits}} أرقام بالضبط',
        mismatch: 'الأرقام لا تطابق رقم الشيك المتوقع',
      },
    },
    state: {
      idle: 'جاهز للإرسال',
      sending: 'جارٍ الإرسال إلى الطابعة…',
      sent: 'أُرسل إلى الطابعة',
      failed: 'رفضت الطابعة المهمة',
    },
    backToList: 'رجوع إلى الشيكات الصادرة',
  },
  permissions: {
    cheques: {
      issued: {
        view: 'عرض الشيكات الصادرة',
        create: 'إنشاء مسودة شيك',
        print: 'طباعة شيك',
        deliver: 'تسليم شيك',
      },
      received: {
        view: 'عرض الشيكات الواردة',
      },
      reports: {
        view: 'عرض التقارير',
      },
      settings: {
        manage: 'إدارة إعدادات المستأجر',
      },
    },
  },
  forbidden: {
    title: '403 — غير مسموح',
    description: 'حسابك لا يملك الصلاحية التي تتطلبها هذه الشاشة.',
    requiredPermission: 'الصلاحية المطلوبة: {{permission}}',
    scopeNote: 'قد تكون الصلاحية ممنوحة على نطاق شركة أو حساب بنكي لا يمكنك الوصول إليه.',
    back: 'رجوع إلى الشيكات الصادرة',
  },
  notFound: {
    title: '404 — غير موجود',
    description: 'هذه الشاشة غير موجودة، أو أن السجل خارج نطاقك.',
    back: 'رجوع إلى الشيكات الصادرة',
  },
  error: {
    title: 'حدث خطأ ما',
    description: 'خطأ غير متوقع منع عرض هذه الشاشة.',
    retry: 'أعد تحميل الشاشة',
  },
};
