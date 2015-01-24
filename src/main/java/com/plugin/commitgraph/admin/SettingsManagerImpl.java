/**
 * Default implementation of SettingsManager.
 */

package com.plugin.commitgraph.admin;

import com.atlassian.activeobjects.external.ActiveObjects;
import com.atlassian.stash.repository.Repository;
import net.java.ao.DBParam;
import net.java.ao.Query;

public class SettingsManagerImpl implements SettingsManager {

    private final ActiveObjects ao;

    public SettingsManagerImpl (ActiveObjects ao) {
        this.ao = ao;
    }

    @Override
    public RepositorySettings getRepositorySettings (Repository repository) {
        String repoId = repository.getProject().getKey() + "^" + repository.getSlug();
        RepositorySettings [] settings;
        synchronized (ao) {
            settings = ao.find(RepositorySettings.class,
                Query.select().where("REPOSITORY_ID = ?", repoId));
        }
        if (settings.length > 0) {
            return settings[0];
        }
        synchronized (ao) {
            return ao.create(RepositorySettings.class, new DBParam("REPOSITORY_ID", repoId));
        }
    }

    @Override
    public RepositorySettings setRepositorySettings (
            Repository repository,
            boolean useRegex,
            String refRegex,
            String refRegexReplace,
            boolean useGravatar,
            boolean createLinks) {
        String repoId = repository.getProject().getKey() + "^" + repository.getSlug();
        RepositorySettings[] settings;
        synchronized (ao) {
            settings = ao.find(RepositorySettings.class,
                Query.select().where("REPOSITORY_ID = ?", repoId));
        }
        if (settings.length > 0) {
            settings[0].setUseRegex(useRegex);
            settings[0].setRefRegex(refRegex);
            settings[0].setRefRegexReplace(refRegexReplace);
            settings[0].setUseGravatar(useGravatar);
            settings[0].setCreateLinks(createLinks);
            settings[0].save();
            return settings[0];
        }
        synchronized (ao) {
            return ao.create(
                RepositorySettings.class,
                new DBParam("REPOSITORY_ID", repoId),
                new DBParam("USE_REGEX", useRegex),
                new DBParam("REF_REGEX", refRegex),
                new DBParam("REF_REGEX_REPLACE", refRegexReplace),
                new DBParam("USE_GRAVATAR", useGravatar),
                new DBParam("CREATE_LINKS", createLinks)
            );
        }
    }

}
