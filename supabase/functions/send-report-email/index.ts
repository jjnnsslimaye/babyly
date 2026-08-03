import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface ReportRecord {
  id: string
  reporter_id: string
  report_type: 'listing' | 'message' | 'conversation'
  target_id: string
  reason: string
  comment: string | null
  created_at: string
}

interface WebhookPayload {
  type: 'INSERT'
  table: string
  record: ReportRecord
  schema: string
}

Deno.serve(async (req) => {
  try {
    const payload: WebhookPayload = await req.json()
    const report = payload.record

    // Initialize Supabase client to get reporter details
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get reporter details
    const { data: reporter } = await supabase
      .from('users')
      .select('first_name, last_name')
      .eq('id', report.reporter_id)
      .single()

    const reporterName = reporter
      ? `${reporter.first_name} ${reporter.last_name}`
      : 'Unknown user'

    // Format email
    const subject = `[Babyly Report] ${report.report_type.charAt(0).toUpperCase() + report.report_type.slice(1)} reported`

    const body = `
      <h2>New ${report.report_type} report</h2>

      <table style="border-collapse: collapse; width: 100%;">
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Report ID</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${report.id}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Type</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${report.report_type}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Reason</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${report.reason}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Comment</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${report.comment || 'None'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Reporter</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${reporterName} (${report.reporter_id})</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Target ID</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${report.target_id}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Submitted</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${new Date(report.created_at).toLocaleString()}</td>
        </tr>
      </table>

      <br/>
      <a href="https://supabase.com/dashboard/project/wspwjkdfmhjmhrtukmsc/editor" 
         style="background: #A4C8D8; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">
        Review in Supabase
      </a>
    `

    // Send email via Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: 'app.babyly@gmail.com',
        subject,
        html: body,
      }),
    })

    const resendResult = await resendResponse.json()
    console.log('Resend result:', JSON.stringify(resendResult))

    return new Response(
      JSON.stringify({ success: true, result: resendResult }),
      { status: 200 }
    )

  } catch (err) {
    console.error('Report email error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500 }
    )
  }
})