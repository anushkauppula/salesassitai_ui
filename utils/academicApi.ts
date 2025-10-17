// Academic API Helper Functions
// Helper functions for the new academic-focused backend endpoints

import { BASE_URL } from './config';

// Search academic programs by text
export const searchPrograms = async (searchText: string): Promise<any> => {
  try {
    const response = await fetch(`${BASE_URL}/search_programs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ query: searchText }),
    });

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error searching programs:', error);
    throw error;
  }
};

// Get exploration history
export const getExplorationHistory = async (): Promise<any> => {
  try {
    const response = await fetch(`${BASE_URL}/exploration_history`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get history: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting exploration history:', error);
    throw error;
  }
};

// Get detailed exploration results
export const getDetailedExploration = async (explorationId: string): Promise<any> => {
  try {
    const response = await fetch(`${BASE_URL}/exploration/${explorationId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get exploration details: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting detailed exploration:', error);
    throw error;
  }
};

// Generate detailed career guidance
export const generateDetailedAnalysis = async (explorationData: any): Promise<any> => {
  try {
    const response = await fetch(`${BASE_URL}/generate_detailed_analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(explorationData),
    });

    if (!response.ok) {
      throw new Error(`Analysis failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error generating detailed analysis:', error);
    throw error;
  }
};

// Format academic recommendations for display
export const formatAcademicRecommendations = (data: any): string => {
  if (!data.recommendations) {
    return data.analysis || data.summary || 'No recommendations available.';
  }

  const { recommendations } = data;
  let formattedText = '🎓 **Your Academic Path Recommendations**\n\n';

  // Format majors
  if (recommendations.majors && recommendations.majors.length > 0) {
    formattedText += '**🎯 Recommended Majors:**\n\n';
    recommendations.majors.forEach((major: any, index: number) => {
      formattedText += `${index + 1}. **${major.name}**\n`;
      if (major.description) {
        formattedText += `   ${major.description}\n`;
      }
      if (major.career_paths && major.career_paths.length > 0) {
        formattedText += `   🚀 **Career Paths:** ${major.career_paths.join(', ')}\n`;
      }
      if (major.skills_developed && major.skills_developed.length > 0) {
        formattedText += `   💪 **Skills Developed:** ${major.skills_developed.join(', ')}\n`;
      }
      formattedText += '\n';
    });
  }

  // Format minors
  if (recommendations.minors && recommendations.minors.length > 0) {
    formattedText += '\n**📚 Suggested Minors:**\n';
    recommendations.minors.forEach((minor: any, index: number) => {
      formattedText += `${index + 1}. ${minor.name}\n`;
    });
    formattedText += '\n';
  }

  // Format career guidance
  if (recommendations.career_guidance) {
    formattedText += '\n**💡 Career Guidance:**\n';
    formattedText += recommendations.career_guidance + '\n\n';
  }

  // Format next steps
  if (recommendations.next_steps && recommendations.next_steps.length > 0) {
    formattedText += '**📋 Next Steps:**\n';
    recommendations.next_steps.forEach((step: any, index: number) => {
      formattedText += `${index + 1}. ${step}\n`;
    });
  }

  return formattedText;
};

// Validate academic response format
export const isValidAcademicResponse = (data: any): boolean => {
  return (
    data &&
    (data.recommendations ||
      data.analysis ||
      data.summary ||
      data.transcription ||
      data.text)
  );
};
