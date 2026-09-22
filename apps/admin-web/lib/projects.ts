import type { ProjectStatus } from './api/types';
export const projectStatuses: Record<ProjectStatus, string> = { draft: '草稿', active: '进行中', archived: '已归档' };
