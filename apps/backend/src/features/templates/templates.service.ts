import type {
  CreateTemplateInput,
  PreviewTemplateInput,
  PublishVersionInput,
  Template,
  TemplatePreview,
  TemplateVersion,
  TemplateWithVersions,
} from '@communique/core';

import type { CursorPage, CursorPayload } from '../../lib/cursor.js';
import { ConflictError, NotFoundError, UnprocessableError } from '../../lib/errors.js';
import { newId } from '../../lib/ids.js';
import { ok, fail, type ServiceResult } from '../../lib/service-result.js';
import { extractVars, renderTemplate } from '../../lib/template-render.js';

import { templatesRepository } from './templates.repository.js';

export const templatesService = {
  async create(workspaceId: string, input: CreateTemplateInput): Promise<ServiceResult<Template>> {
    if (await templatesRepository.nameExists(workspaceId, input.name)) {
      return fail(new ConflictError(`A template named "${input.name}" already exists.`));
    }
    const template = await templatesRepository.create({
      id: newId('template'),
      workspaceId,
      name: input.name,
      eventType: input.event_type,
      channel: input.channel,
    });
    return ok(template);
  },

  async get(workspaceId: string, id: string): Promise<ServiceResult<TemplateWithVersions>> {
    const template = await templatesRepository.findById(workspaceId, id);
    if (!template) return fail(new NotFoundError('Template not found.'));
    const versions = await templatesRepository.listVersions(id);
    return ok({ ...template, versions });
  },

  async list(
    workspaceId: string,
    opts: { limit: number; cursor?: CursorPayload },
  ): Promise<ServiceResult<CursorPage<Template>>> {
    return ok(await templatesRepository.list(workspaceId, opts));
  },

  /**
   * Publishes a new immutable version. If `required_vars` isn't supplied, it's
   * derived from the {{ vars }} referenced in the body/subject.
   */
  async publishVersion(
    workspaceId: string,
    templateId: string,
    input: PublishVersionInput,
  ): Promise<ServiceResult<TemplateVersion>> {
    const template = await templatesRepository.findById(workspaceId, templateId);
    if (!template) return fail(new NotFoundError('Template not found.'));

    const requiredVars =
      input.required_vars ?? extractVars(input.subject, input.body_text, input.body_html);

    const version = await templatesRepository.publishVersion({
      id: newId('templateVersion'),
      templateId,
      subject: input.subject ?? null,
      bodyText: input.body_text,
      bodyHtml: input.body_html ?? null,
      requiredVars,
    });
    return ok(version);
  },

  async listVersions(
    workspaceId: string,
    templateId: string,
  ): Promise<ServiceResult<TemplateVersion[]>> {
    const template = await templatesRepository.findById(workspaceId, templateId);
    if (!template) return fail(new NotFoundError('Template not found.'));
    return ok(await templatesRepository.listVersions(templateId));
  },

  async getVersion(
    workspaceId: string,
    templateId: string,
    version: number,
  ): Promise<ServiceResult<TemplateVersion>> {
    const template = await templatesRepository.findById(workspaceId, templateId);
    if (!template) return fail(new NotFoundError('Template not found.'));
    const v = await templatesRepository.getVersion(templateId, version);
    if (!v) return fail(new NotFoundError('Template version not found.'));
    return ok(v);
  },

  /** Live preview with variable substitution; reports any missing required vars. */
  async preview(
    workspaceId: string,
    templateId: string,
    input: PreviewTemplateInput,
  ): Promise<ServiceResult<TemplatePreview>> {
    const template = await templatesRepository.findById(workspaceId, templateId);
    if (!template) return fail(new NotFoundError('Template not found.'));

    const version = input.version
      ? await templatesRepository.getVersion(templateId, input.version)
      : await templatesRepository.getLatestVersion(templateId);
    if (!version) {
      return fail(new UnprocessableError('Template has no published version to preview.'));
    }

    const vars = input.variables;
    const subject = version.subject ? renderTemplate(version.subject, vars) : null;
    const bodyText = renderTemplate(version.body_text, vars);
    const bodyHtml = version.body_html ? renderTemplate(version.body_html, vars) : null;

    const missing = version.required_vars.filter(
      (v) => vars[v] === undefined || vars[v] === null,
    );

    return ok({
      subject: subject?.output ?? null,
      body_text: bodyText.output,
      body_html: bodyHtml?.output ?? null,
      missing_vars: missing,
    });
  },
};
