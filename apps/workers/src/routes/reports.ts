import { Hono } from 'hono';
import { z } from 'zod';
import { createReportTemplateSchema, updateReportTemplateSchema } from '@baileys/schemas';

import { authMiddleware } from '../middleware/auth';
import { createSupabaseClient } from '../services/supabase';
import { ReportGenerator } from '../services/report-generator';
import { PDFGenerator } from '../services/pdf-generator';

const reports = new Hono<{ Bindings: Env; Variables: { user: any } }>();

reports.use('/*', authMiddleware);

reports.get('/', async (c) => {
	const supabase = createSupabaseClient(c.env);
	const user = c.get('user');
	
	const { data: tenant } = await supabase
		.from('tenants')
		.select('id')
		.eq('user_id', user.id)
		.single();
	
	if (!tenant) {
		return c.json({ error: 'Tenant not found' }, 404);
	}
	
	const { data: reports, error } = await supabase
		.from('generated_reports')
		.select('*')
		.eq('tenant_id', tenant.id)
		.order('created_at', { ascending: false })
		.limit(50);
	
	if (error) {
		return c.json({ error: error.message }, 500);
	}
	
	return c.json(reports);
});

reports.post('/generate/:templateId', async (c) => {
	const supabase = createSupabaseClient(c.env);
	const user = c.get('user');
	const templateId = c.req.param('templateId');
	const parameters = await c.req.json().catch(() => ({}));
	
	if (!templateId) {
		return c.json({ error: 'Template ID is required' }, 400);
	}
	
	const { data: tenant } = await supabase
		.from('tenants')
		.select('id')
		.eq('user_id', user.id)
		.single();
	
	if (!tenant) {
		return c.json({ error: 'Tenant not found' }, 404);
	}
	
	const { data: template } = await supabase
		.from('report_templates')
		.select('*')
		.eq('id', templateId)
		.single();
	
	if (!template) {
		return c.json({ error: 'Template not found' }, 404);
	}
	
	const generator = new ReportGenerator(supabase);
	
	try {
		const report = await generator.generate(
			tenant.id,
			template,
			parameters
		);
		
		const { data: savedReport, error } = await supabase
			.from('generated_reports')
			.insert({
				tenant_id: tenant.id,
				template_id: templateId,
				name: `${template.name} - ${new Date().toLocaleDateString()}`,
				format: template.format,
				parameters,
				data: report,
				created_at: new Date().toISOString()
			})
			.select()
			.single();
		
		if (error) {
			throw error;
		}
		
		return c.json(savedReport);
	} catch (error: any) {
		return c.json({ error: error.message }, 500);
	}
});

reports.get('/templates', async (c) => {
	const supabase = createSupabaseClient(c.env);
	const user = c.get('user');
	
	const { data: tenant } = await supabase
		.from('tenants')
		.select('id')
		.eq('user_id', user.id)
		.single();
	
	if (!tenant) {
		return c.json({ error: 'Tenant not found' }, 404);
	}
	
	const { data: templates, error } = await supabase
		.from('report_templates')
		.select('*')
		.eq('tenant_id', tenant.id)
		.order('name');
	
	if (error) {
		return c.json({ error: error.message }, 500);
	}
	
	return c.json(templates || []);
});

reports.post('/templates', async (c) => {
	const supabase = createSupabaseClient(c.env);
	const user = c.get('user');
	const body = await c.req.json();
	
	const validation = createReportTemplateSchema.safeParse(body);
	if (!validation.success) {
		return c.json({ 
			error: validation.error.issues.map((e: any) => e.message).join(', ')
		}, 400);
	}
	
	const { data: tenant } = await supabase
		.from('tenants')
		.select('id')
		.eq('user_id', user.id)
		.single();
	
	if (!tenant) {
		return c.json({ error: 'Tenant not found' }, 404);
	}
	
	const { data: template, error } = await supabase
		.from('report_templates')
		.insert({
			tenant_id: tenant.id,
			name: body.name,
			description: body.description,
			config: body.config,
			schedule_config: body.scheduleConfig,
			format: body.format || 'pdf',
			is_system: false,
			created_at: new Date().toISOString()
		})
		.select()
		.single();
	
	if (error) {
		return c.json({ error: error.message }, 500);
	}
	
	return c.json(template, 201);
});

reports.get('/templates/:id', async (c) => {
	const templateId = c.req.param('id');
	const supabase = createSupabaseClient(c.env);
	const user = c.get('user');
	
	const { data: tenant } = await supabase
		.from('tenants')
		.select('id')
		.eq('user_id', user.id)
		.single();
	
	if (!tenant) {
		return c.json({ error: 'Tenant not found' }, 404);
	}
	
	const { data: template, error } = await supabase
		.from('report_templates')
		.select('*')
		.eq('id', templateId)
		.eq('tenant_id', tenant.id)
		.single();
	
	if (error || !template) {
		return c.json({ error: 'Template not found' }, 404);
	}
	
	return c.json(template);
});

reports.put('/templates/:id', async (c) => {
	const templateId = c.req.param('id');
	const supabase = createSupabaseClient(c.env);
	const user = c.get('user');
	const body = await c.req.json();
	
	const validation = updateReportTemplateSchema.safeParse(body);
	if (!validation.success) {
		return c.json({ 
			error: validation.error.issues.map((e: any) => e.message).join(', ')
		}, 400);
	}
	
	const { data: tenant } = await supabase
		.from('tenants')
		.select('id')
		.eq('user_id', user.id)
		.single();
	
	if (!tenant) {
		return c.json({ error: 'Tenant not found' }, 404);
	}
	
	const { data: template, error } = await supabase
		.from('report_templates')
		.update({
			name: body.name,
			description: body.description,
			config: body.config,
			schedule_config: body.scheduleConfig,
			format: body.format,
			updated_at: new Date().toISOString()
		})
		.eq('id', templateId)
		.eq('tenant_id', tenant.id)
		.select()
		.single();
	
	if (error) {
		return c.json({ error: error.message }, 500);
	}
	
	if (!template) {
		return c.json({ error: 'Template not found' }, 404);
	}
	
	return c.json(template);
});

reports.delete('/templates/:id', async (c) => {
	const templateId = c.req.param('id');
	const supabase = createSupabaseClient(c.env);
	const user = c.get('user');
	
	const { data: tenant } = await supabase
		.from('tenants')
		.select('id')
		.eq('user_id', user.id)
		.single();
	
	if (!tenant) {
		return c.json({ error: 'Tenant not found' }, 404);
	}
	
	const { error } = await supabase
		.from('report_templates')
		.delete()
		.eq('id', templateId)
		.eq('tenant_id', tenant.id);
	
	if (error) {
		return c.json({ error: error.message }, 500);
	}
	
	return c.json({ success: true });
});

reports.get('/:id', async (c) => {
	const reportId = c.req.param('id');
	const supabase = createSupabaseClient(c.env);
	const user = c.get('user');
	
	const { data: tenant } = await supabase
		.from('tenants')
		.select('id')
		.eq('user_id', user.id)
		.single();
	
	if (!tenant) {
		return c.json({ error: 'Tenant not found' }, 404);
	}
	
	const { data: report, error } = await supabase
		.from('generated_reports')
		.select('*')
		.eq('id', reportId)
		.eq('tenant_id', tenant.id)
		.single();
	
	if (error || !report) {
		return c.json({ error: 'Report not found' }, 404);
	}
	
	return c.json(report);
});

reports.delete('/:id', async (c) => {
	const reportId = c.req.param('id');
	const supabase = createSupabaseClient(c.env);
	const user = c.get('user');
	
	const { data: tenant } = await supabase
		.from('tenants')
		.select('id')
		.eq('user_id', user.id)
		.single();
	
	if (!tenant) {
		return c.json({ error: 'Tenant not found' }, 404);
	}
	
	const { error } = await supabase
		.from('generated_reports')
		.delete()
		.eq('id', reportId)
		.eq('tenant_id', tenant.id);
	
	if (error) {
		return c.json({ error: error.message }, 500);
	}
	
	return c.json({ success: true });
});

reports.post('/quick-generate', async (c) => {
	const supabase = createSupabaseClient(c.env);
	const user = c.get('user');
	const config = await c.req.json();
	
	const { data: tenant } = await supabase
		.from('tenants')
		.select('id')
		.eq('user_id', user.id)
		.single();
	
	if (!tenant) {
		return c.json({ error: 'Tenant not found' }, 404);
	}
	
	const generator = new ReportGenerator(supabase);
	
	try {
		const reportData = await generator.generateQuickReport(
			tenant.id,
			config
		);
		
		const pdfGenerator = new PDFGenerator(supabase);
		const pdfBuffer = await pdfGenerator.generatePDF(reportData);
		
		return new Response(pdfBuffer, {
			headers: {
				'Content-Type': 'application/pdf',
				'Content-Disposition': `attachment; filename="report-${Date.now()}.pdf"`
			}
		});
	} catch (error: any) {
		return c.json({ error: error.message }, 500);
	}
});

export { reports };