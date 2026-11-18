export function consensusFor(records, toleranceMinutes) {
  const valid = records.filter(record =>
    record.status === 'RECEIVED' &&
    Number.isFinite(record.delayMinutes) &&
    record.delayMinutes >= 0
  );
  let agreeingGroup = [];
  for (const candidate of valid) {
    const group = valid.filter(record => Math.abs(record.delayMinutes - candidate.delayMinutes) <= toleranceMinutes);
    if (group.length > agreeingGroup.length) agreeingGroup = group;
  }
  if (agreeingGroup.length < 2) {
    return { status: 'VERIFICATION_PENDING', agreeingSourceIds: [], delayMinutes: undefined };
  }
  const delayMinutes = Math.round(
    agreeingGroup.reduce((total, record) => total + record.delayMinutes, 0) / agreeingGroup.length
  );
  return {
    status: 'VERIFIED',
    agreeingSourceIds: agreeingGroup.map(record => record.sourceId),
    delayMinutes
  };
}
