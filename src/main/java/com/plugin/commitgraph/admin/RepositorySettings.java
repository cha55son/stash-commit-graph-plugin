/**
 * Repository settings for stash codesearch.
 */

package com.plugin.commitgraph.admin;

import net.java.ao.Entity;
import net.java.ao.Preload;
import net.java.ao.schema.Default;
import net.java.ao.schema.NotNull;
import net.java.ao.schema.Table;
import net.java.ao.schema.Unique;

@Table("CGNRepoSettings")
@Preload
public interface RepositorySettings extends Entity {

    @NotNull
    @Unique
    public String getRepositoryId ();
    public void setRepositoryId (String value);

    // Regex for issue id
    public static final boolean USE_REGEX_DEFAULT = false;
    @NotNull
    @Default(USE_REGEX_DEFAULT + "")
    public boolean getUseRegex();
    public void setUseRegex(boolean value);

    // Regex for issue id
    public static final String REF_REGEX_DEFAULT = "\\\\B#(\\\\d+)";
    @NotNull
    @Default(REF_REGEX_DEFAULT)
    public String getRefRegex();
    public void setRefRegex(String value);

    // Regex replace for issue id
    public static final String REF_REGEX_REPLACE_DEFAULT = "http://some.website/issue/$1";
    @NotNull
    @Default(REF_REGEX_REPLACE_DEFAULT)
    public String getRefRegexReplace();
    public void setRefRegexReplace(String value);

    // Use Gravatar service
    public static final boolean USE_GRAVATAR_DEFAULT = false;
    @NotNull
    @Default(USE_GRAVATAR_DEFAULT + "")
    public boolean getUseGravatar();
    public void setUseGravatar(boolean value);

    // Create links in commit messages
    public static final boolean CREATE_LINKS_DEFAULT = false;
    @NotNull
    @Default(CREATE_LINKS_DEFAULT + "")
    public boolean getCreateLinks();
    public void setCreateLinks(boolean value);
}
