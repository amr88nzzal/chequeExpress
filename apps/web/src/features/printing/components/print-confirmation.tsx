import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Button, Card, Group, Stack, Text, TextInput, Title } from '@mantine/core';
import {
  CONFIRMATION_DIGITS,
  printConfirmErrorKey,
  type PrintConfirmIssue,
} from '../lib/confirmation';
import {
  createPrintConfirmationSchema,
  type PrintConfirmationValues,
} from '../lib/confirmation-schema';

export interface PrintConfirmationProps {
  /** The number the server says is reserved — the operator must find it on the leaf. */
  expectedChequeNumber: string;
  digits?: number;
  submitting?: boolean;
  onConfirm: (loadedSuffix: string) => void;
}

export function PrintConfirmation({
  expectedChequeNumber,
  digits = CONFIRMATION_DIGITS,
  submitting = false,
  onConfirm,
}: PrintConfirmationProps) {
  const { t } = useTranslation();
  const schema = useMemo(
    () => createPrintConfirmationSchema(expectedChequeNumber, digits),
    [expectedChequeNumber, digits],
  );
  const methods = useForm<PrintConfirmationValues>({
    resolver: zodResolver(schema),
    defaultValues: { loadedSuffix: '' },
    mode: 'onSubmit',
  });

  // A new cheque means a new expectation: clear whatever was typed before.
  useEffect(() => {
    methods.reset({ loadedSuffix: '' });
  }, [expectedChequeNumber, methods]);

  const messageFor = (code: string | undefined): string | undefined => {
    if (!code) return undefined;
    return t(printConfirmErrorKey(code as PrintConfirmIssue), { digits });
  };

  return (
    <Card withBorder padding="md">
      <Title order={3}>{t('print.confirm.title')}</Title>
      <Text size="sm" c="dimmed" mt={4}>
        {t('print.confirm.instruction', { digits })}
      </Text>
      <form onSubmit={methods.handleSubmit((values) => onConfirm(values.loadedSuffix))} noValidate>
        <Stack gap="md" mt="md">
          <Controller
            control={methods.control}
            name="loadedSuffix"
            render={({ field, fieldState }) => (
              <TextInput
                label={t('print.confirm.field', { digits })}
                value={field.value}
                error={messageFor(fieldState.error?.message)}
                inputMode="numeric"
                autoComplete="off"
                maxLength={digits}
                className="numeric-cell"
                onChange={(event) => field.onChange(event.currentTarget.value)}
                onBlur={field.onBlur}
              />
            )}
          />
          <Group justify="flex-end">
            <Button
              type="button"
              variant="default"
              onClick={() => methods.reset({ loadedSuffix: '' })}
            >
              {t('print.confirm.actions.cancel')}
            </Button>
            <Button type="submit" loading={submitting}>
              {t('print.confirm.actions.confirm')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Card>
  );
}
