import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Award, Download, Share2, Eye } from 'lucide-react';
import type { Certificate } from '../../../server/src/schema';

interface CertificateDisplayProps {
  certificates: Certificate[];
}

export function CertificateDisplay({ certificates }: CertificateDisplayProps) {
  const handleDownload = (certificate: Certificate) => {
    // In a real app, this would trigger certificate download
    alert(`Downloading certificate ${certificate.certificate_code}`);
  };

  const handleShare = (certificate: Certificate) => {
    // In a real app, this would open sharing options
    const shareUrl = `${window.location.origin}/certificate/${certificate.certificate_code}`;
    navigator.clipboard.writeText(shareUrl);
    alert('Certificate link copied to clipboard!');
  };

  const handleView = (certificate: Certificate) => {
    // In a real app, this would open certificate in new window
    window.open(certificate.certificate_url || '#', '_blank');
  };

  if (certificates.length === 0) {
    return (
      <div className="text-center py-12">
        <Award className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-600 mb-2">No Certificates Yet</h3>
        <p className="text-gray-500 mb-4">Complete courses to earn your first certificate!</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {certificates.map((certificate: Certificate) => (
        <Card key={certificate.id} className="border-2 border-yellow-200 bg-gradient-to-r from-yellow-50 to-amber-50">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                  <Award className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Course Certificate</CardTitle>
                  <p className="text-sm text-gray-600">Course ID: {certificate.course_id}</p>
                </div>
              </div>
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                Verified
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Certificate Preview */}
            <div className="bg-white border-2 border-dashed border-yellow-300 rounded-lg p-6 text-center">
              <div className="text-4xl mb-2">🏆</div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Certificate of Completion</h3>
              <p className="text-gray-600 mb-4">
                This certifies that <strong>Student</strong> has successfully completed the course
              </p>
              <div className="text-sm text-gray-500 space-y-1">
                <p>Certificate Code: <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                  {certificate.certificate_code}
                </span></p>
                <p>Issued on: {certificate.issued_at.toLocaleDateString()}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex space-x-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleView(certificate)}
                className="flex-1"
              >
                <Eye className="h-4 w-4 mr-2" />
                View
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownload(certificate)}
                className="flex-1"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleShare(certificate)}
                className="flex-1"
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>

            {/* Additional Info */}
            <div className="text-xs text-gray-500 pt-2 border-t border-yellow-200">
              <p>This certificate can be verified using the certificate code above.</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}