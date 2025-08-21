import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/utils/trpc';
import type { CreateCourseInput } from '../../../server/src/schema';

interface CourseManagementProps {
  onCourseCreated: () => void;
}

export function CourseManagement({ onCourseCreated }: CourseManagementProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [courseData, setCourseData] = useState<CreateCourseInput>({
    title: '',
    description: '',
    thumbnail_url: null,
    price: 0,
    duration_hours: 1
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await trpc.createCourse.mutate(courseData);
      setCourseData({
        title: '',
        description: '',
        thumbnail_url: null,
        price: 0,
        duration_hours: 1
      });
      onCourseCreated();
    } catch (error) {
      console.error('Failed to create course:', error);
      alert('Failed to create course');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Course Title</Label>
        <Input
          id="title"
          value={courseData.title}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setCourseData((prev: CreateCourseInput) => ({ ...prev, title: e.target.value }))
          }
          placeholder="Enter course title"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={courseData.description}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            setCourseData((prev: CreateCourseInput) => ({ ...prev, description: e.target.value }))
          }
          placeholder="Describe your course"
          rows={4}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="thumbnail">Thumbnail URL (optional)</Label>
        <Input
          id="thumbnail"
          type="url"
          value={courseData.thumbnail_url || ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setCourseData((prev: CreateCourseInput) => ({
              ...prev,
              thumbnail_url: e.target.value || null
            }))
          }
          placeholder="https://example.com/image.jpg"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="price">Price ($)</Label>
          <Input
            id="price"
            type="number"
            step="0.01"
            min="0"
            value={courseData.price}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setCourseData((prev: CreateCourseInput) => ({
                ...prev,
                price: parseFloat(e.target.value) || 0
              }))
            }
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="duration">Duration (hours)</Label>
          <Input
            id="duration"
            type="number"
            step="0.5"
            min="0.5"
            value={courseData.duration_hours}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setCourseData((prev: CreateCourseInput) => ({
                ...prev,
                duration_hours: parseFloat(e.target.value) || 1
              }))
            }
            required
          />
        </div>
      </div>

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? 'Creating Course...' : 'Create Course'}
      </Button>
    </form>
  );
}