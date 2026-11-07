import { describe, expect, it } from 'vitest';
import {
  doorFrame,
  doorHeldOpen,
  doorSpeed,
  doorWanted,
  DOOR_SWING_MS,
  stepDoor,
} from './doorAnimation';

const DOOR = { x: 0, y: 10 };

describe('drzwi wejściowe (prezentacja)', () => {
  it('otwiera je idąca postać w pobliżu, nie stojąca obok ani daleka', () => {
    expect(doorWanted(DOOR, [{ position: { x: 1.5, y: 10.5 }, walking: true }])).toBe(true);
    expect(doorWanted(DOOR, [{ position: { x: -0.5, y: 10.5 }, walking: true }])).toBe(true);
    expect(doorWanted(DOOR, [{ position: { x: 1.5, y: 10.5 }, walking: false }])).toBe(false);
    expect(doorWanted(DOOR, [{ position: { x: 3.5, y: 10.5 }, walking: true }])).toBe(false);
    expect(doorWanted(DOOR, [])).toBe(false);
  });

  it('postać stojąca w samym przejściu trzyma drzwi otwarte', () => {
    expect(doorWanted(DOOR, [{ position: { x: 0.5, y: 10.5 }, walking: false }])).toBe(true);
  });

  it('pełny ruch trwa DOOR_SWING_MS przy 1×, przy 4× czterokrotnie krócej, pauza stoi', () => {
    expect(stepDoor(0, true, DOOR_SWING_MS, 1)).toBe(1);
    expect(stepDoor(0, true, DOOR_SWING_MS / 4, 4)).toBe(1);
    expect(stepDoor(0, true, DOOR_SWING_MS / 2, 1)).toBeCloseTo(0.5);
    expect(stepDoor(0.5, true, 1000, 0)).toBe(0.5);
    expect(stepDoor(1, false, DOOR_SWING_MS, 1)).toBe(0);
    expect(stepDoor(0.2, false, DOOR_SWING_MS, 2)).toBe(0);
  });

  it('klatka: zamknięte bez nakładki, dalej kolejne fazy do ostatniej', () => {
    expect(doorFrame(0, 5)).toBeNull();
    expect(doorFrame(0.05, 5)).toBeNull();
    expect(doorFrame(0.2, 5)).toBe(0);
    expect(doorFrame(0.6, 5)).toBe(2);
    expect(doorFrame(1, 5)).toBe(4);
  });

  it('rano i po pracy drzwi są otwarte dla wszystkich, w dzień — według postaci', () => {
    expect(doorHeldOpen('arriving')).toBe(true);
    expect(doorHeldOpen('leaving')).toBe(true);
    expect(doorHeldOpen('working')).toBe(false);
    expect(doorHeldOpen('workEnded')).toBe(false);
  });

  it('po pracy (pauza rozliczenia) drzwi domykają się w tempie 1×; w dzień — tempo gry', () => {
    expect(doorSpeed('workEnded', 0)).toBe(1);
    expect(doorSpeed('settled', 0)).toBe(1);
    expect(doorSpeed('working', 0)).toBe(0);
    expect(doorSpeed('leaving', 4)).toBe(4);
  });
});
