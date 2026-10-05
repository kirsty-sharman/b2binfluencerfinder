// Shared by recommendation reads and shortlisting; old assessments never imply a pass.
export const ADMISSION_VERSION = 7;
export const rejectionReasons = ["Audience too small", "Wrong target market", "Not an active creator", "Incorrect profile information", "Other"] as const;
export function currentQualification(channel: {channel:string;audience?:number|null;qualification?:{version?:number;qualified?:boolean}|null}) {
  if (!channel.qualification?.qualified || channel.qualification.version !== ADMISSION_VERSION) return false;
  if (["linkedin","x","youtube"].includes(channel.channel)) return typeof channel.audience === "number" && Number.isFinite(channel.audience) && channel.audience >= 1000;
  return true;
}
