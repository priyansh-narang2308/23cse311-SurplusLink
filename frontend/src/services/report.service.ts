import api from '@/lib/api';
import { UtilizationRecord, VolunteerPerformanceReport, ImpactSummary } from '../types';

class ReportService {
    async getNgoUtilization(ngoId?: string, startDate?: string, endDate?: string): Promise<UtilizationRecord> {
        const params: Record<string, string> = {};
        if (ngoId) params.ngoId = ngoId;
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;

        const response = await api.get('/reports/ngo-utilization', { params });
        return response.data;
    }

    async getNgoUtilizationMasterList(): Promise<UtilizationRecord[]> {
        const response = await api.get('/reports/ngo-utilization');
        return response.data;
    }

    async getVolunteerPerformance(): Promise<VolunteerPerformanceReport> {
        const response = await api.get('/reports/volunteer-performance');
        return response.data;
    }

    async getSafetyCompliance(startDate?: string, endDate?: string) {
        const params: Record<string, string> = {};
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
        const response = await api.get('/reports/safety-compliance', { params });
        return response.data;
    }

    async getImpactSummary(startDate?: string, endDate?: string): Promise<ImpactSummary> {
        const params: Record<string, string> = {};
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
        const response = await api.get('/reports/impact-summary', { params });
        return response.data;
    }
}

export default new ReportService();
