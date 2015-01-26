/**
 * Stores and retrieves codesearch global settings.
 */

package com.plugin.commitgraph.admin;
import com.atlassian.stash.repository.Repository;

public interface SettingsManager {
    RepositorySettings getRepositorySettings (Repository repository);

    RepositorySettings setRepositorySettings (
        Repository repository,
        boolean useRegex,
        String refRegex,
        String refRegexReplace,
        boolean useGravatar,
        boolean createLinks);
}
