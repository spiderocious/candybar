import type { Channel, RoutingRule } from '@communique/core';

import { pool } from '../../lib/db.js';

interface RuleRow {
  id: string;
  workspace_id: string;
  event_type: string;
  channel: string;
  audience_id: string | null;
  template_id: string;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

const toRule = (r: RuleRow): RoutingRule => ({
  id: r.id,
  workspace_id: r.workspace_id,
  event_type: r.event_type,
  channel: r.channel as Channel,
  audience_id: r.audience_id,
  template_id: r.template_id,
  enabled: r.enabled,
  created_at: r.created_at.toISOString(),
  updated_at: r.updated_at.toISOString(),
});

export const routingRulesRepository = {
  async create(
    params: {
      id: string;
      workspaceId: string;
      eventType: string;
      channel: Channel;
      audienceId: string | null;
      templateId: string;
      enabled: boolean;
    },
  ): Promise<RoutingRule> {
    const r = await pool.query<RuleRow>(
      `INSERT INTO routing_rules
         (id, workspace_id, event_type, channel, audience_id, template_id, enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, workspace_id, event_type, channel, audience_id, template_id, enabled, created_at, updated_at`,
      [
        params.id,
        params.workspaceId,
        params.eventType,
        params.channel,
        params.audienceId,
        params.templateId,
        params.enabled,
      ],
    );
    return toRule(r.rows[0]!);
  },

  async findById(workspaceId: string, id: string): Promise<RoutingRule | null> {
    const r = await pool.query<RuleRow>(
      `SELECT id, workspace_id, event_type, channel, audience_id, template_id, enabled, created_at, updated_at
         FROM routing_rules WHERE workspace_id = $1 AND id = $2`,
      [workspaceId, id],
    );
    return r.rows[0] ? toRule(r.rows[0]) : null;
  },

  async list(workspaceId: string): Promise<RoutingRule[]> {
    const r = await pool.query<RuleRow>(
      `SELECT id, workspace_id, event_type, channel, audience_id, template_id, enabled, created_at, updated_at
         FROM routing_rules WHERE workspace_id = $1 ORDER BY event_type, channel`,
      [workspaceId],
    );
    return r.rows.map(toRule);
  },

  /** Enabled rules matching an event type — drives dispatch routing. */
  async findEnabledForEvent(workspaceId: string, eventType: string): Promise<RoutingRule[]> {
    const r = await pool.query<RuleRow>(
      `SELECT id, workspace_id, event_type, channel, audience_id, template_id, enabled, created_at, updated_at
         FROM routing_rules
        WHERE workspace_id = $1 AND event_type = $2 AND enabled = TRUE
        ORDER BY channel`,
      [workspaceId, eventType],
    );
    return r.rows.map(toRule);
  },

  async update(
    workspaceId: string,
    id: string,
    fields: {
      channel?: Channel;
      templateId?: string;
      audienceId?: string | null;
      enabled?: boolean;
    },
  ): Promise<RoutingRule | null> {
    const sets: string[] = [];
    const params: unknown[] = [workspaceId, id];
    if (fields.channel !== undefined) {
      params.push(fields.channel);
      sets.push(`channel = $${params.length}`);
    }
    if (fields.templateId !== undefined) {
      params.push(fields.templateId);
      sets.push(`template_id = $${params.length}`);
    }
    if (fields.audienceId !== undefined) {
      params.push(fields.audienceId);
      sets.push(`audience_id = $${params.length}`);
    }
    if (fields.enabled !== undefined) {
      params.push(fields.enabled);
      sets.push(`enabled = $${params.length}`);
    }
    if (sets.length === 0) return this.findById(workspaceId, id);
    const r = await pool.query(
      `UPDATE routing_rules SET ${sets.join(', ')} WHERE workspace_id = $1 AND id = $2`,
      params,
    );
    if (r.rowCount === 0) return null;
    return this.findById(workspaceId, id);
  },

  async remove(workspaceId: string, id: string): Promise<boolean> {
    const r = await pool.query(`DELETE FROM routing_rules WHERE workspace_id = $1 AND id = $2`, [
      workspaceId,
      id,
    ]);
    return r.rowCount! > 0;
  },
};
