export type EventCategory = 'briefing' | 'open_school' | 'festival' | 'application' | 'exam' | 'result' | 'enrollment' | 'other';
export type EventStatus = 'candidate' | 'verified' | 'quarantined' | 'cancelled';

export interface School {
  id: string;
  name: string;
  name_reading?: string;
  aliases?: string[];
  prefecture?: string | null;
  municipality?: string | null;
  ownership?: string | null;
  gender?: string | null;
  secondary_education_type?: string | null;
  monitoring_status?: 'verified';
  verified_event_count?: number;
  last_verified_at?: string | null;
  official_sources: string[];
}

export interface AdmissionEvent {
  id: string;
  school_id: string;
  title: string;
  category: EventCategory;
  starts_at: string;
  ends_at: string | null;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  target_grades: number[];
  admission_year: number;
  source_url: string;
  source_type: 'official_web' | 'official_pdf' | 'municipal_web' | 'municipal_pdf';
  retrieved_at: string;
  verified_at: string | null;
  status: EventStatus;
  confidence: 'low' | 'medium' | 'high';
  content_hash: string | null;
  change_note: string;
  change_type?: 'new' | 'changed' | 'cancelled';
}

export interface MockExamOrganizer {
  id: string;
  name: string;
  official_sources: string[];
}

export interface MockExamEvent {
  id: string;
  organizer_id: string;
  title: string;
  category: 'mock_exam' | 'registration_open';
  starts_at: string;
  ends_at: string | null;
  target_grades: number[];
  admission_year: number;
  source_url: string;
  retrieved_at: string;
  verified_at: string | null;
  status: EventStatus;
  confidence: 'low' | 'medium' | 'high';
}

export interface CalendarExportEvent {
  id: string;
  title: string;
  owner_name: string;
  starts_at: string;
  ends_at: string | null;
  source_url: string;
  verified_at: string | null;
  status: EventStatus;
}
