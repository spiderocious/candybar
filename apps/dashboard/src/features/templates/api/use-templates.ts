import type {
  CreateTemplateInput,
  PreviewTemplateInput,
  PublishVersionInput,
  Template,
  TemplatePreview,
  TemplateVersion,
  TemplateWithVersions,
} from '@communique/core';
import { EP } from '@communique/core';
import { apiClient } from '@shared/services/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';


export const templatesKey = () => ['templates'] as const;
export const templateKey = (id: string) => ['template', id] as const;

export function useTemplates() {
  return useQuery({
    queryKey: templatesKey(),
    queryFn: () => apiClient.list<Template>(EP.TEMPLATES),
  });
}

export function useTemplate(id: string) {
  return useQuery({
    queryKey: templateKey(id),
    queryFn: () => apiClient.get<TemplateWithVersions>(EP.TEMPLATE(id)),
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTemplateInput) => apiClient.post<Template>(EP.TEMPLATES, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: templatesKey() }),
  });
}

export function usePublishVersion(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PublishVersionInput) =>
      apiClient.post<TemplateVersion>(EP.TEMPLATE_VERSIONS(id), input),
    onSuccess: () => qc.invalidateQueries({ queryKey: templateKey(id) }),
  });
}

export function usePreviewTemplate(id: string) {
  return useMutation({
    mutationFn: (input: PreviewTemplateInput) =>
      apiClient.post<TemplatePreview>(EP.TEMPLATE_PREVIEW(id), input),
  });
}
