import type { RawCaseFiles } from "../../domain/case-package"
import type { MasterData } from "@oc/contracts"

/** Output port: where case packages and master data come from (fixtures today, SAP/mailbox later). */
export interface DataSource {
  listCases(): Promise<string[]>
  loadRawCase(caseId: string): Promise<RawCaseFiles>
  loadMasterData(): Promise<MasterData>
}
