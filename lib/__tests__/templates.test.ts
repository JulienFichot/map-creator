import { describe, it, expect } from 'vitest';
import { TEMPLATES, getTemplate } from '../templates';

const TEMPLATE_IDS = ['seo', 'blue', 'orange', 'minimal', 'artisan'];

describe('TEMPLATES', () => {
  it('contains all expected IDs', () => {
    const ids = TEMPLATES.map((t) => t.id);
    for (const id of TEMPLATE_IDS) expect(ids).toContain(id);
  });

  it('has unique IDs', () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(TEMPLATES.length);
  });

  it('each template has a non-empty label and description', () => {
    for (const t of TEMPLATES) {
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.description.length).toBeGreaterThan(0);
    }
  });

  it('each template style has a valid hex backgroundColor', () => {
    for (const t of TEMPLATES) {
      expect(t.style.backgroundColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('each template style has required color fields', () => {
    const colorFields = [
      'backgroundColor', 'mainDepartmentColor', 'neighborDepartmentColor',
      'borderColor', 'circleColor', 'markerColor',
    ] as const;
    for (const t of TEMPLATES) {
      for (const field of colorFields) {
        expect(typeof t.style[field]).toBe('string');
        expect(t.style[field]).toMatch(/^#/);
      }
    }
  });

  it('each template style has numeric sizing fields', () => {
    for (const t of TEMPLATES) {
      expect(typeof t.style.borderWidth).toBe('number');
      expect(typeof t.style.markerSize).toBe('number');
      expect(typeof t.style.deptLabelSize).toBe('number');
    }
  });

  it('templates have different backgroundColors', () => {
    const colors = new Set(TEMPLATES.map((t) => t.style.backgroundColor));
    expect(colors.size).toBeGreaterThan(1);
  });

  it('minimal template does not show dept labels', () => {
    const minimal = TEMPLATES.find((t) => t.id === 'minimal')!;
    expect(minimal.style.showDeptNumber).toBe(false);
    expect(minimal.style.showDeptName).toBe(false);
  });

  it('seo template shows dept number by default', () => {
    const seo = TEMPLATES.find((t) => t.id === 'seo')!;
    expect(seo.style.showDeptNumber).toBe(true);
  });
});

describe('getTemplate', () => {
  it('returns the template matching the given id', () => {
    for (const id of TEMPLATE_IDS) {
      const t = getTemplate(id);
      expect(t.id).toBe(id);
    }
  });

  it('falls back to the first template for unknown id', () => {
    const fallback = getTemplate('nonexistent');
    expect(fallback).toBe(TEMPLATES[0]);
  });

  it('returns the same object reference as TEMPLATES array entry', () => {
    for (const id of TEMPLATE_IDS) {
      const t = getTemplate(id);
      const direct = TEMPLATES.find((x) => x.id === id)!;
      expect(t).toBe(direct);
    }
  });
});
