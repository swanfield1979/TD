import assert from 'node:assert/strict'
import test from 'node:test'
import { nyseSyncWindow } from '../shared/nyse-session.mjs'

test('synchroniseert ieder heel uur van NYSE pre-market tot en met de slotbel', () => {
  assert.equal(nyseSyncWindow(new Date('2026-10-05T07:00:00Z')).shouldSync, false)
  assert.equal(nyseSyncWindow(new Date('2026-10-05T08:00:00Z')).shouldSync, true)
  assert.equal(nyseSyncWindow(new Date('2026-10-05T20:00:00Z')).shouldSync, true)
  assert.equal(nyseSyncWindow(new Date('2026-10-05T21:00:00Z')).shouldSync, false)
})

test('zomertijd wordt in New York bepaald en niet met een vaste Nederlandse offset', () => {
  const winter = nyseSyncWindow(new Date('2026-12-01T09:00:00Z'))
  const summer = nyseSyncWindow(new Date('2026-10-05T08:00:00Z'))
  assert.equal(winter.hour, 4)
  assert.equal(summer.hour, 4)
})

test('weekenden en officiële NYSE-feestdagen starten geen Gateway of IB Key', () => {
  assert.equal(nyseSyncWindow(new Date('2026-10-04T15:00:00Z')).reason, 'weekend')
  assert.equal(nyseSyncWindow(new Date('2026-12-25T15:00:00Z')).reason, 'NYSE-feestdag')
  assert.equal(nyseSyncWindow(new Date('2027-07-05T15:00:00Z')).shouldSync, false)
  assert.equal(nyseSyncWindow(new Date('2028-07-04T15:00:00Z')).shouldSync, false)
})

test('een officiële vroege sluiting stopt de synchronisatie na 13:00 ET', () => {
  assert.equal(nyseSyncWindow(new Date('2026-11-27T18:00:00Z')).shouldSync, true)
  assert.equal(nyseSyncWindow(new Date('2026-11-27T19:00:00Z')).shouldSync, false)
})
