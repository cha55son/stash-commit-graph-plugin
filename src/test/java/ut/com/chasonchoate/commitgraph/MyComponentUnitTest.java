package ut.com.chasonchoate.commitgraph;

import org.junit.Test;
import com.chasonchoate.commitgraph.MyPluginComponent;
import com.chasonchoate.commitgraph.MyPluginComponentImpl;

import static org.junit.Assert.assertEquals;

public class MyComponentUnitTest
{
    @Test
    public void testMyName()
    {
        MyPluginComponent component = new MyPluginComponentImpl(null);
        assertEquals("names do not match!", "myComponent",component.getName());
    }
}