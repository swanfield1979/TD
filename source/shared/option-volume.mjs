const known = value => typeof value === 'number' && Number.isFinite(value) && value >= 0
export function volumeSnapshot(quote, cached, now = new Date()) {
  const stamp = now.toISOString()
  const fresh = at => typeof at === 'string' && Date.parse(at) <= now.getTime() && now.getTime() - Date.parse(at) <= 7 * 86400000
  const average = known(quote.avgOptionVolume) ? quote.avgOptionVolume : fresh(cached?.avgOptionVolumeAt) && known(cached.avgOptionVolume) ? cached.avgOptionVolume : undefined
  const daily = known(quote.callOptionVolume) && known(quote.putOptionVolume) ? quote.callOptionVolume + quote.putOptionVolume : fresh(cached?.dayOptionVolumeAt) && known(cached.dayOptionVolume) ? cached.dayOptionVolume : undefined
  return { avgOptionVolume: average, avgOptionVolumeAt: average === undefined ? undefined : known(quote.avgOptionVolume) ? stamp : cached.avgOptionVolumeAt,
    dayOptionVolume: daily, dayOptionVolumeAt: daily === undefined ? undefined : known(quote.callOptionVolume) && known(quote.putOptionVolume) ? stamp : cached.dayOptionVolumeAt,
    volumeSource: known(quote.avgOptionVolume) ? 'broker' : average === undefined ? 'unknown' : 'cache' }
}
export function volumeGate(volume, minimum) {
  if (minimum === 0) return 'disabled'
  if (!known(volume?.avgOptionVolume)) return 'unknown'
  return volume.avgOptionVolume >= minimum ? 'pass' : 'below'
}
