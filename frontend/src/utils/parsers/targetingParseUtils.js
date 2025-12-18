// Utils to parse Facebook targeting structures to frontend format

/**
 * Parse flexible_spec from Facebook format back to frontend format
 * Used for Edit Mode to populate DetailedTargetingSelector
 * @param {Array} flexibleSpec - Facebook flexible_spec array
 * @returns {Array} Frontend targeting items format
 */
export function parseFlexibleSpecToFrontend(flexibleSpec) {
  if (!flexibleSpec || !Array.isArray(flexibleSpec) || flexibleSpec.length === 0) {
    return [];
  }

  const items = [];

  flexibleSpec.forEach((specGroup) => {
    // Interests
    if (specGroup.interests && Array.isArray(specGroup.interests)) {
      specGroup.interests.forEach((interest) => {
        items.push({
          id: interest.id,
          name: interest.name,
          type: "interest",
        });
      });
    }

    // Behaviors
    if (specGroup.behaviors && Array.isArray(specGroup.behaviors)) {
      specGroup.behaviors.forEach((behavior) => {
        items.push({
          id: behavior.id,
          name: behavior.name,
          type: "behavior",
        });
      });
    }

    // Life events
    if (specGroup.life_events && Array.isArray(specGroup.life_events)) {
      specGroup.life_events.forEach((event) => {
        items.push({
          id: event.id,
          name: event.name,
          type: "life_event",
        });
      });
    }

    // Family statuses
    if (specGroup.family_statuses && Array.isArray(specGroup.family_statuses)) {
      specGroup.family_statuses.forEach((status) => {
        items.push({
          id: status.id,
          name: status.name,
          type: "family_status",
        });
      });
    }

    // Work employers
    if (specGroup.work_employers && Array.isArray(specGroup.work_employers)) {
      specGroup.work_employers.forEach((employer) => {
        items.push({
          id: employer.id,
          name: employer.name,
          type: "work",
        });
      });
    }

    // Work positions
    if (specGroup.work_positions && Array.isArray(specGroup.work_positions)) {
      specGroup.work_positions.forEach((position) => {
        items.push({
          id: position.id,
          name: position.name,
          type: "job_title",
        });
      });
    }

    // Education schools
    if (specGroup.education_schools && Array.isArray(specGroup.education_schools)) {
      specGroup.education_schools.forEach((school) => {
        items.push({
          id: school.id,
          name: school.name,
          type: "education",
        });
      });
    }
  });

  return items;
}


