'use server';

import { signIn } from "@/auth";
import { sql } from "@vercel/postgres";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";


const InvoiceSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: '顧客IDを入力してください',
  }),
  amount: z.coerce
    .number()
    .gt(0, { message: '請求金額は0円より大きくなければなりません' })
  ,
  status: z.enum(['pending', 'paid', ],
    {invalid_type_error: '請求書のステータスを入力してください'}
  ),
  date: z.date(),
});

const CreateInvoice = InvoiceSchema.omit({ id: true, date: true });

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};
 
export async function createInvoice(prevState: State,formData: FormData) {
  const validatedFields = CreateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });
  console.log(validatedFields);
  if (!validatedFields.success) {
    return { 
      errors: validatedFields.error.flatten().fieldErrors,
      message: '請求書は作成できませんでした',
     };
  }

  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0];

  try {
    await sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;
  } catch (error) {
    return { message: 'Database Error: 請求書は作成できませんでした'};
  }
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

const UpdateInvoice = InvoiceSchema.omit({ id: true,date: true });

export async function updateInvoice(id:string, prevState: State,formData: FormData) {
  const validatedFields = UpdateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });
  console.log('validatedFields',validatedFields);
  if (!validatedFields.success) {
    return { 
      errors: validatedFields.error.flatten().fieldErrors,
      message: '請求書は更新できませんでした',
     };
  }
  const { customerId, amount, status } = validatedFields.data;
 
  const amountInCents = amount * 100;
 
  try {
    await sql`
      UPDATE invoices
      SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
      WHERE id = ${id}
    `;
  } catch (error) {
    return { message: 'Database Error: 請求書は更新できませんでした'}
  }
  console.log('update revalidatePath');
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

const DeleteInvoice = InvoiceSchema.pick({ id: true });

export async function deleteInvoice(formData: FormData) {
  throw new Error('請求書は削除できませんでした');
  const {id} = DeleteInvoice.parse({id: formData.get('id')?.toString()}) ;

  try {
    await sql`DELETE FROM invoices WHERE id = ${id}`;
    revalidatePath('/dashboard/invoices');
    return { message: '請求書は削除されました'}
  } catch (error) {
    return { message: 'Database Error: 請求書は削除できませんでした'}
  }
}

export async function authenticate(
  prevState: string | undefined,
  formData: FormData
) {
  try {
    await signIn('credentials', Object.fromEntries(formData));
  } catch (error) {
    if ((error as Error).message.includes('CredentialsSignin')) {
      return 'CredentialsSignin';
    }
    throw error;
  }
}