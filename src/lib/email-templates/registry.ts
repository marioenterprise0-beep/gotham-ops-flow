import type { ComponentType } from 'react'

import { template as scheduleSubmitted } from './schedule-submitted'
import { template as scheduleApproved } from './schedule-approved'
import { template as schedulePublished } from './schedule-published'
import { template as scheduleLocked } from './schedule-locked'
import { template as scheduleChanged } from './schedule-changed'
import { template as missedClockOut } from './missed-clock-out'
import { template as autoClockOut } from './auto-clock-out'
import { template as timeAdjustmentRequest } from './time-adjustment-request'
import { template as timeAdjustmentApproved } from './time-adjustment-approved'
import { template as timeAdjustmentDeclined } from './time-adjustment-declined'
import { template as inventoryOrderSubmitted } from './inventory-order-submitted'
import { template as inventoryOrderApproved } from './inventory-order-approved'
import { template as inventoryOrderDeclined } from './inventory-order-declined'
import { template as lowStockAlert } from './low-stock-alert'
import { template as cashDrawerSubmitted } from './cash-drawer-submitted'
import { template as cashVarianceAlert } from './cash-variance-alert'
import { template as cashDropSubmitted } from './cash-drop-submitted'
import { template as trainingAssigned } from './training-assigned'
import { template as trainingCompleted } from './training-completed'
import { template as hrDocumentAssigned } from './hr-document-assigned'
import { template as hrDocumentSigned } from './hr-document-signed'
import { template as dailyRecapSubmitted } from './daily-recap-submitted'
import { template as announcementPublished } from './announcement-published'
import { template as criticalAlert } from './critical-alert'
import { template as dailyDigest } from './daily-digest'
import { template as nightSummary } from './night-summary'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'schedule-submitted': scheduleSubmitted,
  'schedule-approved': scheduleApproved,
  'schedule-published': schedulePublished,
  'schedule-locked': scheduleLocked,
  'schedule-changed': scheduleChanged,
  'missed-clock-out': missedClockOut,
  'auto-clock-out': autoClockOut,
  'time-adjustment-request': timeAdjustmentRequest,
  'time-adjustment-approved': timeAdjustmentApproved,
  'time-adjustment-declined': timeAdjustmentDeclined,
  'inventory-order-submitted': inventoryOrderSubmitted,
  'inventory-order-approved': inventoryOrderApproved,
  'inventory-order-declined': inventoryOrderDeclined,
  'low-stock-alert': lowStockAlert,
  'cash-drawer-submitted': cashDrawerSubmitted,
  'cash-variance-alert': cashVarianceAlert,
  'cash-drop-submitted': cashDropSubmitted,
  'training-assigned': trainingAssigned,
  'training-completed': trainingCompleted,
  'hr-document-assigned': hrDocumentAssigned,
  'hr-document-signed': hrDocumentSigned,
  'daily-recap-submitted': dailyRecapSubmitted,
  'announcement-published': announcementPublished,
  'critical-alert': criticalAlert,
  'daily-digest': dailyDigest,
  'night-summary': nightSummary,
}
