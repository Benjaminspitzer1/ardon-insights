import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'npm:@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { document_id, storage_path, file_type } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Mark as processing
    if (document_id) {
      await supabase.from('documents').update({ extraction_status: 'processing' }).eq('id', document_id)
    }

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(storage_path)

    if (downloadError || !fileData) throw new Error('Failed to download file')

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

    let extractedData: any = {}

    const isExcel = file_type?.includes('spreadsheet') || storage_path?.match(/\.(xlsx|xls|csv)$/i)
    const isPDF = file_type === 'application/pdf' || storage_path?.match(/\.pdf$/i)

    if (isPDF) {
      // Use Claude vision to extract from PDF
      const buffer = await fileData.arrayBuffer()
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)))

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: base64 },
            },
            {
              type: 'text',
              text: `Extract all structured CRE investment data from this document. Return a JSON object with these fields (omit any you cannot find):
{
  "property": { "name": "", "address": "", "city": "", "state": "", "zip": "", "property_type": "", "purchase_price": 0, "sf": 0, "year_built": 0 },
  "financials": { "gross_rental_income": 0, "other_income": 0, "vacancy_rate": 0, "operating_expenses": 0, "noi": 0 },
  "rent_roll": [{ "unit_number": "", "unit_type": "", "tenant_name": "", "monthly_rent": 0, "sf": 0, "lease_start": "", "lease_end": "", "status": "occupied" }],
  "debt": [{ "tranche_name": "", "loan_amount": 0, "interest_rate": 0, "amort_years": 0, "term_months": 0, "tranche_type": "senior" }],
  "summary": "one sentence description of the document"
}
Return ONLY valid JSON, no explanation.`,
            },
          ],
        }],
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : ''
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        extractedData = jsonMatch ? JSON.parse(jsonMatch[0]) : { summary: text }
      } catch {
        extractedData = { summary: text }
      }
    } else {
      // For Excel/CSV, return a message directing to client-side parsing
      extractedData = {
        summary: 'Excel/CSV file — use the Import from Excel button to parse and map columns directly.',
        file_type: 'excel',
      }
    }

    // Save extraction result
    if (document_id) {
      await supabase.from('documents').update({
        extracted_data: extractedData,
        extraction_status: 'done',
      }).eq('id', document_id)
    }

    return new Response(JSON.stringify({ success: true, data: extractedData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
