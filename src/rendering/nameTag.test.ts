import { describe, expect, it } from 'vitest';
import { PEOPLE, PROLOGUE_OWNER } from '../domain/content/people';
import { firstNameOf, NAME_TAG, nameTagSize } from './nameTag';

describe('dymek z imieniem', () => {
  it('pokazuje samo imię każdej osoby', () => {
    expect(firstNameOf('ola-pikselska')).toBe('Ola');
    expect(firstNameOf(PROLOGUE_OWNER.id)).toBe('Janusz');
    for (const person of PEOPLE) {
      expect(firstNameOf(person.id)).toMatch(/^\p{L}+$/u);
    }
  });

  it('nieznana osoba nie dostaje imienia', () => {
    expect(firstNameOf('nie-ma-takiej')).toBe('');
  });

  it('mieści tekst z marginesami i dzióbek', () => {
    const size = nameTagSize(30.2);
    expect(size.width).toBeGreaterThanOrEqual(30.2 + NAME_TAG.paddingX * 2);
    expect(size.height).toBeGreaterThanOrEqual(NAME_TAG.height + NAME_TAG.tailHeight);
  });
});
