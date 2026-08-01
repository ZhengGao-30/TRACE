/**
 * HSE site model -- the analogue of lib/room.ts + three/layout3d.ts for the
 * permit-to-work and compliance jobs.
 *
 * ALFWorld gives the room its furniture from `receptacles` and parses a command
 * into (verb, target). An HSE job is not a household room: the agent moves
 * between plant assets -- a tank, a valve manifold, a gas detector, a rescue
 * tripod, a permit desk -- and each recorded action happens AT one of them.
 *
 * So the site is a fixed set of stations per job, and every action string maps
 * to the station it is performed at. That mapping is what lets the robot walk
 * the job instead of standing still.
 */

export type StationKind =
  | 'tank' | 'bund' | 'valve' | 'fan' | 'cabinet' | 'instrument'
  | 'rescue' | 'desk' | 'drum' | 'hose' | 'drain' | 'board'

export interface Station {
  id: string
  label: string
  kind: StationKind
  x: number
  z: number
  rot?: number
  /**
   * Footprint radius in world units -- how far out the geometry actually
   * reaches. The robot's stand-off is derived from this, so it can never end up
   * inside a tank or a bund wall.
   */
  r: number
  /** matched against the action string, first hit wins */
  match: RegExp
}

/** Clearance between a station's footprint and where the robot stands. */
export const STAND_CLEARANCE = 1.5

/**
 * Where the robot stands to work a station.
 *
 * Always due SOUTH of the station (+z), never scaled toward the site origin.
 * Two reasons, both learned the hard way:
 *   - scaling toward the origin puts the stand point INSIDE any station that
 *     sits near the centre (the T-114 tank swallowed the robot whole);
 *   - the chase camera always trails the robot from the south, so standing on
 *     the south face keeps the robot in front of its station instead of behind
 *     it, and keeps tall geometry from cutting the shot.
 */
export function standAt(st: Station): [number, number] {
  return [st.x, st.z + st.r + STAND_CLEARANCE]
}

export interface SiteModel {
  id: string
  title: string
  subtitle: string
  ground: 'concrete' | 'asphalt'
  radius: number
  stations: Station[]
}

// ---------------------------------------------------------------------------
// Site 1 -- digester tank T-114, confined-space entry
// ---------------------------------------------------------------------------
const CONFINED_SPACE: SiteModel = {
  id: 'hse_confined_space',
  title: 'T-114 digester',
  subtitle: 'confined-space entry permit',
  ground: 'concrete',
  radius: 17,
  // Layout rule: the tall geometry (the tank) sits at the NORTH edge as a
  // backdrop, and every station the robot works is south of it. The chase
  // camera trails from the south, so nothing tall ever gets between it and the
  // robot.
  stations: [
    { id: 'tank', label: 'T-114 tank', kind: 'tank', x: 0, z: -9.0, r: 3.0,
      match: /purge_duration|space=T-114$|brief entrants|lighting|barrier|signage/ },
    { id: 'iso', label: 'ISO-7/8', kind: 'cabinet', x: -6.8, z: -6.0, r: 1.2, rot: 0.3,
      match: /energy_isolation|isolation_point|ISO-/ },
    { id: 'valves', label: 'V-101/102/103', kind: 'valve', x: 6.6, z: -6.0, r: 1.8, rot: -0.3,
      match: /loto_tag|valve=|blind_flange|lockout_register/ },
    { id: 'fan2', label: 'FAN-2', kind: 'fan', x: -9.6, z: -2.0, r: 1.1, rot: 0.6,
      match: /FAN-2/ },
    { id: 'fan3', label: 'FAN-3', kind: 'fan', x: 9.6, z: -2.2, r: 1.1, rot: -0.6,
      match: /FAN-3|ventilation_fan|airflow/ },
    { id: 'gas', label: 'GM-4471 gas meter', kind: 'instrument', x: -5.0, z: 1.4, r: 0.9, rot: 0.3,
      match: /gas_meter|meter_calibration|bump_test|meter_battery|gas_detector_count|msds/ },
    { id: 'rescue', label: 'rescue station', kind: 'rescue', x: 5.2, z: 1.4, r: 1.5, rot: -0.3,
      match: /rescue_team|retrieval_equipment|TRIPOD|scba|harness|standby_vehicle|communication_link|radio/ },
    { id: 'muster', label: 'muster point', kind: 'board', x: -7.8, z: 5.2, r: 1.2, rot: 0.4,
      match: /competency_register|cert_expiry|medical_clearance|attendant_assigned|worker=|incident_history|previous_permit|first_aid|weather/ },
    { id: 'desk', label: 'permit office', kind: 'desk', x: 1.4, z: 5.4, r: 2.2,
      match: /permit|compile|countersign|attach evidence|notify control_room|issue/ },
  ],
}

// ---------------------------------------------------------------------------
// Site 2 -- containment bund B-7, acid release
// ---------------------------------------------------------------------------
const SPILL_RESPONSE: SiteModel = {
  id: 'hse_spill_response',
  title: 'B-7 containment bund',
  subtitle: 'environmental compliance record',
  ground: 'asphalt',
  radius: 17,
  // Same rule as T-114: the bund is the big footprint, so it anchors the north
  // edge and everything the robot works sits south of it.
  stations: [
    { id: 'bund', label: 'bund B-7', kind: 'bund', x: 0, z: -7.6, r: 3.4,
      match: /bund|boom_deployed|absorbent|release_volume|bund_capacity/ },
    { id: 'hose', label: 'transfer hose TH-4', kind: 'hose', x: -8.2, z: -4.6, r: 1.9, rot: 0.4,
      match: /TH-4|source|ppe_compliance|operator/ },
    { id: 'drain', label: 'stormwater SD-3', kind: 'drain', x: 7.8, z: -4.6, r: 1.1, rot: -0.4,
      match: /drain|SD3|SD-3|tide_state|outfall/ },
    { id: 'sensors', label: 'PH-12 / EC-4 / TOC-2', kind: 'instrument', x: -8.6, z: 0.8, r: 0.9, rot: 0.5,
      match: /calibrated_sensor|sensor_calibration|PH-12|EC-4|TOC-2|reading=/ },
    { id: 'sampling', label: 'sampling point', kind: 'board', x: 8.2, z: 0.8, r: 1.2, rot: -0.5,
      match: /geotagged_sample|chain_of_custody|S-10|photograph|weather/ },
    { id: 'drums', label: 'neutralising store', kind: 'drum', x: -4.6, z: 5.2, r: 1.3, rot: 0.3,
      match: /remediation|neutralis|soda_ash|recovery|soil_removal|msds/ },
    { id: 'desk', label: 'compliance office', kind: 'desk', x: 3.2, z: 5.4, r: 2.2,
      match: /compliance_report|notify|attach evidence|licence_conditions|spill_history|drain_plan|compile|file/ },
  ],
}

export const SITES: Record<string, SiteModel> = {
  confined_space_entry_permit: CONFINED_SPACE,
  environmental_compliance_record: SPILL_RESPONSE,
}

export function siteFor(taskType?: string): SiteModel | null {
  return (taskType && SITES[taskType]) || null
}

/**
 * Which station an action is performed at, or undefined if it belongs nowhere.
 *
 * Returning undefined rather than falling back to stations[0] is deliberate: a
 * silent fallback sends the robot to a confidently WRONG place. The caller
 * treats undefined as "stay where you are", which is exactly right for the
 * read-only attestation (`review last_record`) -- an inert step that touches
 * nothing and must not look like travel to a new asset.
 */
export function stationFor(site: SiteModel, action?: string): Station | undefined {
  if (!action) return undefined
  return site.stations.find((s) => s.match.test(action))
}

/** How the robot should behave on arrival -- drives the animation. */
export type HseAct = 'idle' | 'scan' | 'verify' | 'sample' | 'write' | 'attest'

export function actOf(action?: string, confirm?: boolean): HseAct {
  if (confirm) return 'attest'
  if (!action) return 'idle'
  if (/^read |^re-test |airflow|scba_pressure|estimate /.test(action)) return 'scan'
  if (/^capture |^photograph |^interview /.test(action)) return 'sample'
  if (/^compile |^attach |^request |^issue |^file |^notify |^log |^record /.test(action)) return 'write'
  return 'verify'
}

/** Short human phrasing for the HUD, mirroring lib/room.ts::describe. */
export function describeHse(action?: string, confirm?: boolean): string {
  if (!action) return ''
  if (confirm) return 'read-only attestation · no state change'
  const [verb, ...rest] = action.split(' ')
  return `${verb} ${rest.join(' ')}`
}
